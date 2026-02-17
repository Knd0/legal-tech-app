import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentsList } from './documents-list';

describe('DocumentsList', () => {
  let component: DocumentsList;
  let fixture: ComponentFixture<DocumentsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentsList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DocumentsList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
