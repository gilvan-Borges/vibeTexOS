import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistoricoTecnicoComponent } from './historico-tecnico.component';

describe('HistoricoTecnicoComponent', () => {
  let component: HistoricoTecnicoComponent;
  let fixture: ComponentFixture<HistoricoTecnicoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoricoTecnicoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistoricoTecnicoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
