import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NameScreen } from './name-screen';

describe('NameScreen', () => {
  let component: NameScreen;
  let fixture: ComponentFixture<NameScreen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NameScreen]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NameScreen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
