import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DniGenerator } from './dni-generator';

describe('DniGenerator', () => {
  let component: DniGenerator;
  let fixture: ComponentFixture<DniGenerator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DniGenerator]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DniGenerator);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
