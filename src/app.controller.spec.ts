import { AppController } from './app.controller';

describe('AppController', () => {
  it('returns success on test', () => {
    const controller = new AppController();
    expect(controller.test()).toBe('success');
  });
});
