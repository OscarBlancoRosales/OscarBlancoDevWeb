import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ScrumPoker } from './scrum-poker';

describe('ScrumPoker', () => {
  let component: ScrumPoker;
  let fixture: ComponentFixture<ScrumPoker>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ScrumPoker],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ScrumPoker);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => localStorage.clear());

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('empieza sin votos ni jugadores', () => {
    expect(component.players).toEqual([]);
    expect(component.hasVoted).toBe(false);
    expect(component.showVotes).toBe(false);
  });

  it('acumula votos numéricos', () => {
    component.addVote(3);
    component.addVote(5);
    expect(component.voteBreakdown.numbers).toBe(8);
    expect(component.hasVoted).toBe(true);
  });

  it('los votos especiales sustituyen al número', () => {
    component.addVote(5);
    component.replaceVote('coffee');
    expect(component.voteBreakdown.numbers).toBe(0);
    expect(component.voteBreakdown.coffee).toBe(1);
    expect(component.myVoteDisplay).toBe('☕');
  });

  it('limpiar el voto lo deja a cero', () => {
    component.addVote(8);
    component.clearMyVote();
    expect(component.hasVoted).toBe(false);
    expect(component.voteBreakdown).toEqual({ numbers: 0, coffee: 0, joint: 0 });
  });
});
