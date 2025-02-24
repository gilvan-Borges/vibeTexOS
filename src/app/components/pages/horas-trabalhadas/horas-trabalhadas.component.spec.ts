import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HorasTrabalhadasComponent } from './horas-trabalhadas.component';

describe('HorasTrabalhadasComponent', () => {
  let component: HorasTrabalhadasComponent;
  let fixture: ComponentFixture<HorasTrabalhadasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HorasTrabalhadasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HorasTrabalhadasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
