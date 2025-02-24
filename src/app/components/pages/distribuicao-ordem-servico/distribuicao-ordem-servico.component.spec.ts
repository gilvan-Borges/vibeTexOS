import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DistribuicaoOrdemServicoComponent } from './distribuicao-ordem-servico.component';

describe('DistribuicaoOrdemServicoComponent', () => {
  let component: DistribuicaoOrdemServicoComponent;
  let fixture: ComponentFixture<DistribuicaoOrdemServicoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DistribuicaoOrdemServicoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DistribuicaoOrdemServicoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
