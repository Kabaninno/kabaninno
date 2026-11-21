import { describe, expect, it } from 'vitest';
import { routeFocusPlan } from './route-focus';

describe('routeFocusPlan', () => {
  it('forward into a panel route focuses the heading (keyboard or mouse)', () => {
    expect(routeFocusPlan('/', '/services/web/', true)).toEqual({ type: 'heading' });
    expect(routeFocusPlan('/', '/services/web/', false)).toEqual({ type: 'heading' });
    expect(routeFocusPlan('/services/web/', '/services/web/landing-pages/', false)).toEqual({
      type: 'heading',
    });
    expect(routeFocusPlan('/services/web/', '/portfolio/', true)).toEqual({ type: 'heading' });
  });

  it('sideways between siblings focuses the heading', () => {
    expect(routeFocusPlan('/services/web/a/', '/services/web/b/', true)).toEqual({
      type: 'heading',
    });
    expect(routeFocusPlan('/services/web/', '/services/crm/', true)).toEqual({ type: 'heading' });
  });

  it('planet ↔ planet switching (arrows / swipe, router.replace) focuses the new heading', () => {
    expect(routeFocusPlan('/services/crm/a/', '/services/crm/d/', true)).toEqual({
      type: 'heading',
    });
    expect(routeFocusPlan('/services/crm/d/', '/services/crm/a/', false)).toEqual({
      type: 'heading',
    });
  });

  it('back up to the universe with the keyboard returns to the node link', () => {
    expect(routeFocusPlan('/services/web/', '/', true)).toEqual({
      type: 'link',
      paths: ['/services/web/'],
      fallback: 'none',
    });
    expect(routeFocusPlan('/services/web/landing-pages/', '/', true)).toEqual({
      type: 'link',
      paths: ['/services/web/landing-pages/', '/services/web/'],
      fallback: 'none',
    });
    expect(routeFocusPlan('/portfolio/', '/', true)).toEqual({
      type: 'link',
      paths: ['/portfolio/'],
      fallback: 'none',
    });
    expect(routeFocusPlan('/configurator/', '/', true)).toEqual({
      type: 'link',
      paths: ['/configurator/'],
      fallback: 'none',
    });
  });

  it('back up to a system with the keyboard returns to the planet link', () => {
    expect(routeFocusPlan('/services/web/landing-pages/', '/services/web/', true)).toEqual({
      type: 'link',
      paths: ['/services/web/landing-pages/', '/services/web/'],
      fallback: 'heading',
    });
    expect(routeFocusPlan('/portfolio/case/', '/portfolio/', true)).toEqual({
      type: 'link',
      paths: ['/portfolio/case/', '/portfolio/'],
      fallback: 'heading',
    });
  });

  it('back up with the mouse: no focus on the universe, heading on a panel route', () => {
    expect(routeFocusPlan('/services/web/', '/', false)).toEqual({ type: 'none' });
    expect(routeFocusPlan('/services/web/a/', '/services/web/', false)).toEqual({
      type: 'heading',
    });
  });

  it('ignores same-route changes and unknown routes; accepts locale prefixes', () => {
    expect(routeFocusPlan('/services/web/', '/services/web', true)).toEqual({ type: 'none' });
    expect(routeFocusPlan('/', '/nope/x/y/z/', true)).toEqual({ type: 'none' });
    expect(routeFocusPlan('/pl/services/web/', '/pl/', true)).toEqual({
      type: 'link',
      paths: ['/services/web/'],
      fallback: 'none',
    });
  });
});
