import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HorasColaboradorComponent } from './horas-colaborador.component';

describe('HorasColaboradorComponent', () => {
  let component: HorasColaboradorComponent;
  let fixture: ComponentFixture<HorasColaboradorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HorasColaboradorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HorasColaboradorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
