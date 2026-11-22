import { describe, expect, it } from 'vitest';
import { ariaCurrentFor, sectionForPath, showsHudCta } from './nav';
import { formatIndex, withTrailingSlash } from './style';

describe('sectionForPath', () => {
  it.each([
    ['/', 'home'],
    ['/services/web/', 'services'],
    ['/services/web/landing-pages', 'services'],
    ['/portfolio', 'portfolio'],
    ['/portfolio/x/', 'portfolio'],
    ['/configurator/', 'configurator'],
    ['/elsewhere/', 'other'],
  ])('%j → %s', (pathname, section) => {
    expect(sectionForPath(pathname)).toBe(section);
  });
});

describe('showsHudCta', () => {
  it('hides the HUD call-to-action on home and the configurator only (D153)', () => {
    expect(showsHudCta(sectionForPath('/'))).toBe(false);
    expect(showsHudCta(sectionForPath('/configurator/'))).toBe(false);
    expect(showsHudCta(sectionForPath('/services/web/'))).toBe(true);
    expect(showsHudCta(sectionForPath('/services/web/landing-pages/'))).toBe(true);
    expect(showsHudCta(sectionForPath('/portfolio/'))).toBe(true);
    expect(showsHudCta(sectionForPath('/privacy/'))).toBe(true);
  });
});

describe('ariaCurrentFor', () => {
  it('marks the exact page', () => {
    expect(ariaCurrentFor('/portfolio/', '/portfolio/')).toBe('page');
    expect(ariaCurrentFor('/portfolio', '/portfolio/')).toBe('page');
    expect(ariaCurrentFor('/', '/')).toBe('page');
  });

  it('marks the section of a nested page', () => {
    expect(ariaCurrentFor('/portfolio/case/', '/portfolio/')).toBe('true');
    expect(ariaCurrentFor('/services/web/landing-pages/', '/services/web/')).toBe('true');
  });

  it('never marks home as the section of other pages', () => {
    expect(ariaCurrentFor('/configurator/', '/')).toBeUndefined();
    expect(ariaCurrentFor('/services/crm/', '/services/web/')).toBeUndefined();
  });
});

describe('style helpers', () => {
  it('pads indices', () => {
    expect(formatIndex(1)).toBe('01');
    expect(formatIndex(12)).toBe('12');
  });

  it('normalizes trailing slashes', () => {
    expect(withTrailingSlash('/a')).toBe('/a/');
    expect(withTrailingSlash('/a/')).toBe('/a/');
  });
});
