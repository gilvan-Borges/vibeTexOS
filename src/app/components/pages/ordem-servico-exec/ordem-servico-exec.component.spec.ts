import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrdemServicoExecComponent } from './ordem-servico-exec.component';

describe('OrdemServicoExecComponent', () => {
  let component: OrdemServicoExecComponent;
  let fixture: ComponentFixture<OrdemServicoExecComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdemServicoExecComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrdemServicoExecComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
