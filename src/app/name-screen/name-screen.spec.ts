import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { NameScreen } from './name-screen';

describe('NameScreen', () => {
  let component: NameScreen;
  let fixture: ComponentFixture<NameScreen>;

  beforeEach(async () => {
    localStorage.setItem('auth_token', 'test');
    await TestBed.configureTestingModule({
      imports: [NameScreen],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NameScreen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => localStorage.clear());

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('genera sala e invitación para el administrador', () => {
    component.ngOnInit();
    expect(component.roomId.startsWith('ROOM-')).toBe(true);
    expect(component.inviteCode).toContain(component.roomId);
  });

  it('exige un nombre de al menos dos letras', () => {
    component.ngOnInit();
    component.nameForm.setValue({ playerName: 'a' });
    expect(component.nameForm.invalid).toBe(true);
    component.nameForm.setValue({ playerName: 'Ana' });
    expect(component.nameForm.valid).toBe(true);
  });
});
