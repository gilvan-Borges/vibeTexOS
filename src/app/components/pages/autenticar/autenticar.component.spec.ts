import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AutenticarComponent } from './autenticar.component';

describe('AutenticarComponent', () => {
  let component: AutenticarComponent;
  let fixture: ComponentFixture<AutenticarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutenticarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AutenticarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
