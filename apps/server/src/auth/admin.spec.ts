import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { loadConfig } from '../config';
import { openDatabase } from '../db/index';
import { invitacionDePrueba } from './testing';
import type { FastifyInstance } from 'fastify';
import type {
  AdminRoomList,
  CreatedInvitation,
  InvitationList,
  SalasBorradas,
  UserList,
} from '@devweb/shared/contracts/admin';
import type { SeatGrant } from '@devweb/shared/contracts/rooms';
import type { PublicUser } from '@devweb/shared/contracts/auth';
import type { Db } from '../db/index';

const JEFE = { email: 'jefe@example.com', password: 'contraseña-larga-1', displayName: 'Jefe' };
const CUALQUIERA = { email: 'otra@example.com', password: 'contraseña-larga-2', displayName: 'Ana' };

const config = loadConfig({
  NODE_ENV: 'test',
  JWT_SECRET: 'x'.repeat(48),
  CORS_ORIGINS: 'https://oscarblancorosales.com',
  ADMIN_EMAILS: JEFE.email,
});

describe('el panel de administración', () => {
  let app: FastifyInstance;
  let db: Db;
  let jefe: string;
  let cualquiera: string;

  async function alta(quien: typeof JEFE): Promise<void> {
    await app.inject({
      method: 'POST',
      url: '/auth/registro',
      payload: { ...quien, invitacion: invitacionDePrueba(db) },
    });
  }

  async function entrar(quien: typeof JEFE): Promise<string> {
    const acceso = await app.inject({
      method: 'POST',
      url: '/auth/acceso',
      payload: { email: quien.email, password: quien.password },
    });
    return acceso.json<{ accessToken: string }>().accessToken;
  }

  beforeEach(async () => {
    db = openDatabase(':memory:');
    app = await buildApp({ config, db });

    await alta(JEFE);
    await alta(CUALQUIERA);
    db.prepare("UPDATE users SET status = 'active'").run();
    // El rol se fija al arrancar a partir de la configuración, y las cuentas se
    // han creado después: se vuelve a aplicar, que es justo lo que pasa en la
    // máquina en el siguiente reinicio.
    await app.close();
    app = await buildApp({ config, db });

    jefe = await entrar(JEFE);
    cualquiera = await entrar(CUALQUIERA);
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  const como = (token: string) => ({ authorization: `Bearer ${token}` });

  describe('quién entra', () => {
    it('el correo de la configuración manda', async () => {
      const yo = await app.inject({ method: 'GET', url: '/auth/yo', headers: como(jefe) });

      expect(yo.json<PublicUser>().role).toBe('admin');
    });

    it('y quien no está en esa lista, no', async () => {
      const yo = await app.inject({ method: 'GET', url: '/auth/yo', headers: como(cualquiera) });

      expect(yo.json<PublicUser>().role).toBe('user');
    });

    /**
     * Un 404 y no un 403: decir «no eres administrador» le confirma a quien
     * prueba que hay un panel ahí detrás al que merece la pena apuntar.
     */
    it('para quien no manda, el panel no existe', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/usuarios',
        headers: como(cualquiera),
      });

      expect(response.statusCode).toBe(404);
    });

    it('sin sesión, tampoco', async () => {
      const response = await app.inject({ method: 'GET', url: '/admin/usuarios' });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('los usuarios', () => {
    it('se listan con su estado y su rol, nunca con su hash', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/usuarios',
        headers: como(jefe),
      });
      const { users } = response.json<UserList>();

      expect(users).toHaveLength(2);
      expect(JSON.stringify(users)).not.toContain('passwordHash');
      expect(JSON.stringify(users)).not.toContain('$argon2');
    });

    it('bloquear a alguien lo echa de sus sesiones abiertas', async () => {
      const { users } = (
        await app.inject({ method: 'GET', url: '/admin/usuarios', headers: como(jefe) })
      ).json<UserList>();
      const victima = users.find((u) => u.email === CUALQUIERA.email);

      await app.inject({
        method: 'PATCH',
        url: `/admin/usuarios/${victima?.id}`,
        headers: como(jefe),
        payload: { status: 'blocked' },
      });

      const refresco = await app.inject({ method: 'POST', url: '/auth/refresco' });
      expect(refresco.statusCode).toBe(401);
    });

    it('borrar una cuenta la borra de verdad', async () => {
      const { users } = (
        await app.inject({ method: 'GET', url: '/admin/usuarios', headers: como(jefe) })
      ).json<UserList>();
      const victima = users.find((u) => u.email === CUALQUIERA.email);

      const response = await app.inject({
        method: 'DELETE',
        url: `/admin/usuarios/${victima?.id}`,
        headers: como(jefe),
      });

      expect(response.statusCode).toBe(200);
      const quedan = (
        await app.inject({ method: 'GET', url: '/admin/usuarios', headers: como(jefe) })
      ).json<UserList>();
      expect(quedan.users).toHaveLength(1);
    });

    /**
     * «Se borra todo lo suyo»: una sala sin dueño no la puede administrar ni
     * cerrar nadie, y sus asientos seguirían dando acceso a la partida.
     */
    it('y se lleva por delante sus salas', async () => {
      const sala = await app.inject({
        method: 'POST',
        url: '/salas',
        headers: como(cualquiera),
        payload: { game: 'flota', name: 'La mía', displayName: 'Ana' },
      });
      const { roomId } = sala.json<{ roomId: string }>();
      const { users } = (
        await app.inject({ method: 'GET', url: '/admin/usuarios', headers: como(jefe) })
      ).json<UserList>();

      await app.inject({
        method: 'DELETE',
        url: `/admin/usuarios/${users.find((u) => u.email === CUALQUIERA.email)?.id}`,
        headers: como(jefe),
      });

      const buscada = await app.inject({ method: 'GET', url: `/salas/${roomId}` });
      expect(buscada.statusCode).toBe(404);
    });

    /**
     * El rol sale de la configuración de la máquina. Borrar o bloquear a un
     * administrador desde una petición dejaría el sistema diciendo una cosa
     * —el fichero— y comportándose de otra hasta el siguiente arranque.
     */
    it('a un administrador no se le toca desde el panel', async () => {
      const { users } = (
        await app.inject({ method: 'GET', url: '/admin/usuarios', headers: como(jefe) })
      ).json<UserList>();
      const admin = users.find((u) => u.role === 'admin');

      const borrado = await app.inject({
        method: 'DELETE',
        url: `/admin/usuarios/${admin?.id}`,
        headers: como(jefe),
      });
      const bloqueo = await app.inject({
        method: 'PATCH',
        url: `/admin/usuarios/${admin?.id}`,
        headers: como(jefe),
        payload: { status: 'blocked' },
      });

      expect(borrado.statusCode).toBe(403);
      expect(bloqueo.statusCode).toBe(403);
    });
  });

  describe('las invitaciones', () => {
    const crear = (token: string) =>
      app.inject({
        method: 'POST',
        url: '/admin/invitaciones',
        headers: como(token),
        payload: { nota: 'para Marta', diasDeVida: 7 },
      });

    it('el enlace sale una sola vez, al crearla', async () => {
      const creada = (await crear(jefe)).json<CreatedInvitation>();

      expect(creada.enlace).toContain('/auth/registro?invitacion=');

      // Al listarlas ya no aparece: solo se guarda su hash.
      const { invitaciones } = (
        await app.inject({ method: 'GET', url: '/admin/invitaciones', headers: como(jefe) })
      ).json<InvitationList>();
      expect(JSON.stringify(invitaciones)).not.toContain(creada.enlace.split('=')[1]);
    });

    it('sirve para darse de alta, y solo una vez', async () => {
      const creada = (await crear(jefe)).json<CreatedInvitation>();
      const token = creada.enlace.split('=')[1] ?? '';

      const primera = await app.inject({
        method: 'POST',
        url: '/auth/registro',
        payload: { email: 'marta@example.com', password: 'contraseña-larga-3', displayName: 'Marta', invitacion: token },
      });
      const segunda = await app.inject({
        method: 'POST',
        url: '/auth/registro',
        payload: { email: 'luis@example.com', password: 'contraseña-larga-4', displayName: 'Luis', invitacion: token },
      });

      expect(primera.statusCode).toBe(201);
      expect(segunda.statusCode).toBe(403);
    });

    it('sin invitación no hay alta', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/registro',
        payload: {
          email: 'colado@example.com',
          password: 'contraseña-larga-5',
          displayName: 'Colado',
          invitacion: 'me-la-invento-entera',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('revocarla la deja sin efecto', async () => {
      const creada = (await crear(jefe)).json<CreatedInvitation>();
      const token = creada.enlace.split('=')[1] ?? '';

      await app.inject({
        method: 'DELETE',
        url: `/admin/invitaciones/${creada.id}`,
        headers: como(jefe),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/registro',
        payload: { email: 'tarde@example.com', password: 'contraseña-larga-6', displayName: 'Tarde', invitacion: token },
      });
      expect(response.statusCode).toBe(403);
    });

    it('quien no manda no puede repartirlas', async () => {
      expect((await crear(cualquiera)).statusCode).toBe(404);
    });
  });

  describe('las salas', () => {
    /** La abre quien no manda: el panel tiene que poder tocarla igual. */
    async function abrirMesa(token: string, nombre = 'La mesa'): Promise<SeatGrant> {
      const creada = await app.inject({
        method: 'POST',
        url: '/salas',
        headers: como(token),
        payload: { game: 'scrum', name: nombre, displayName: 'Ana' },
      });
      return creada.json<SeatGrant>();
    }

    const listar = async (token: string) =>
      app.inject({ method: 'GET', url: '/admin/salas', headers: como(token) });

    it('se ven todas, con su dueño y quién está sentado', async () => {
      await abrirMesa(cualquiera, 'Mesa de Ana');

      const salas = (await listar(jefe)).json<AdminRoomList>().salas;

      expect(salas).toHaveLength(1);
      expect(salas[0]?.name).toBe('Mesa de Ana');
      expect(salas[0]?.duenyo?.email).toBe(CUALQUIERA.email);
      expect(salas[0]?.asientos).toHaveLength(1);
    });

    /**
     * En el Trivial la configuración son las preguntas con sus respuestas.
     * Repartirlas en cada listado del panel sería dar el examen resuelto.
     */
    it('pero la configuración de la partida no viaja', async () => {
      await abrirMesa(cualquiera);

      const salas = (await listar(jefe)).json<AdminRoomList>().salas;

      expect(salas[0]).not.toHaveProperty('config');
    });

    it('quien no manda no las ve', async () => {
      expect((await listar(cualquiera)).statusCode).toBe(404);
    });

    it('quien manda cierra la sala de otro', async () => {
      const mesa = await abrirMesa(cualquiera);

      const response = await app.inject({
        method: 'DELETE',
        url: `/admin/salas/${mesa.room.id}`,
        headers: como(jefe),
      });

      expect(response.statusCode).toBe(200);
      expect((await listar(jefe)).json<AdminRoomList>().salas).toHaveLength(0);
    });

    it('y levanta a alguien de su asiento', async () => {
      const mesa = await abrirMesa(cualquiera);

      const response = await app.inject({
        method: 'DELETE',
        url: `/admin/salas/${mesa.room.id}/asientos/${mesa.seatId}`,
        headers: como(jefe),
      });

      expect(response.statusCode).toBe(200);
      expect((await listar(jefe)).json<AdminRoomList>().salas[0]?.asientos).toHaveLength(0);
    });

    it('un asiento que no existe es un 404, no un borrado silencioso', async () => {
      const mesa = await abrirMesa(cualquiera);

      const response = await app.inject({
        method: 'DELETE',
        url: `/admin/salas/${mesa.room.id}/asientos/no-existe`,
        headers: como(jefe),
      });

      expect(response.statusCode).toBe(404);
    });

    it('el borrado en bloque respeta el filtro', async () => {
      await abrirMesa(cualquiera, 'Una');
      await abrirMesa(cualquiera, 'Otra');

      const nada = await app.inject({
        method: 'DELETE',
        url: '/admin/salas',
        headers: como(jefe),
        payload: { estado: 'finished' },
      });

      expect(nada.json<SalasBorradas>().borradas).toBe(0);
      expect((await listar(jefe)).json<AdminRoomList>().salas).toHaveLength(2);

      const todas = await app.inject({
        method: 'DELETE',
        url: '/admin/salas',
        headers: como(jefe),
        payload: { estado: 'lobby' },
      });

      expect(todas.json<SalasBorradas>().borradas).toBe(2);
      expect((await listar(jefe)).json<AdminRoomList>().salas).toHaveLength(0);
    });

    it('quien no manda no puede cerrar nada', async () => {
      const mesa = await abrirMesa(cualquiera);

      const response = await app.inject({
        method: 'DELETE',
        url: `/admin/salas/${mesa.room.id}`,
        headers: como(cualquiera),
      });

      expect(response.statusCode).toBe(404);
      expect((await listar(jefe)).json<AdminRoomList>().salas).toHaveLength(1);
    });
  });
});
