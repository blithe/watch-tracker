/**
 * Tests that enforce calendar cell visual containment requirements:
 * - Cells must be square (aspect-square)
 * - Images must be clipped to cell bounds (overflow-hidden + contain:paint)
 * - Images must use object-cover cropping
 * - Images must be absolutely positioned (don't affect cell height)
 * - Date badge must be visible over images (dark background)
 * - Date badge must be absolutely positioned (overlay, not in flow)
 */

import React from 'react';
import { render } from '@testing-library/react';
import CalendarCell from '@/app/CalendarCell';

describe('CalendarCell', () => {
  const baseProps = {
    day: 7,
    dateStr: '2026-03-07',
    isToday: false,
    cellImage: null,
    hasLog: false,
  };

  describe('cell containment — prevents image overflow', () => {
    it('image wrapper has overflow-hidden to clip the photo to the cell', () => {
      const { container } = render(<CalendarCell {...baseProps} cellImage="/test.jpg" />);
      const img = container.querySelector('img')!;
      const wrapper = img.parentElement!;
      expect(wrapper.className).toContain('overflow-hidden');
    });

    it('image wrapper has rounded-lg matching the cell border-radius', () => {
      const { container } = render(<CalendarCell {...baseProps} cellImage="/test.jpg" />);
      const img = container.querySelector('img')!;
      const wrapper = img.parentElement!;
      expect(wrapper.className).toContain('rounded-lg');
    });

    it('has an in-flow spacer with pb-[100%] so cells are square even with no in-flow content', () => {
      // aspect-ratio alone does not set cell height when all children are
      // absolutely positioned (no in-flow content = no height contribution).
      // A pb-[100%] spacer div forces height = width purely via padding.
      const { container } = render(<CalendarCell {...baseProps} />);
      const link = container.querySelector('a')!;
      const spacer = Array.from(link.children).find(
        el => el.className.includes('pb-[100%]')
      );
      expect(spacer).toBeDefined();
    });

    it('has self-start so grid cannot stretch cell beyond its square size', () => {
      const { container } = render(<CalendarCell {...baseProps} />);
      const link = container.querySelector('a')!;
      expect(link.className).toContain('self-start');
    });

    it('has relative positioning so children are contained within the cell', () => {
      const { container } = render(<CalendarCell {...baseProps} />);
      const link = container.querySelector('a')!;
      expect(link.className).toContain('relative');
    });
  });

  describe('date badge visibility over images', () => {
    it('badge is NOT inside the image clipping container', () => {
      // If the badge is inside the same overflow-hidden div as the image it can
      // be obscured. The badge must be a sibling of the image wrapper, not a
      // child, so overflow/contain clipping never hides it.
      const { container } = render(<CalendarCell {...baseProps} cellImage="/wrist.jpg" />);
      const img = container.querySelector('img')!;
      const badge = container.querySelector('span')!;
      // The image should be inside a dedicated wrapper div, not directly in <a>
      const imgWrapper = img.parentElement!;
      expect(imgWrapper.tagName.toLowerCase()).not.toBe('a');
      // The badge must NOT be inside that same wrapper
      expect(imgWrapper.contains(badge)).toBe(false);
    });

    it('image wrapper has overflow-hidden to clip the photo', () => {
      const { container } = render(<CalendarCell {...baseProps} cellImage="/wrist.jpg" />);
      const img = container.querySelector('img')!;
      const imgWrapper = img.parentElement!;
      expect(imgWrapper.className).toContain('overflow-hidden');
    });
  });

  describe('image — must fill cell without overflow', () => {
    it('renders an img element when cellImage is provided', () => {
      const { container } = render(<CalendarCell {...baseProps} cellImage="/wrist.jpg" />);
      expect(container.querySelector('img')).toBeInTheDocument();
    });

    it('does not render an img element when no cellImage', () => {
      const { container } = render(<CalendarCell {...baseProps} cellImage={null} />);
      expect(container.querySelector('img')).not.toBeInTheDocument();
    });

    it('image wrapper is absolutely positioned so it does not push cell height', () => {
      const { container } = render(<CalendarCell {...baseProps} cellImage="/wrist.jpg" />);
      const img = container.querySelector('img')!;
      const wrapper = img.parentElement!;
      expect(wrapper.className).toContain('absolute');
      expect(wrapper.className).toContain('inset-0');
    });

    it('image fills the cell with w-full h-full', () => {
      const { container } = render(<CalendarCell {...baseProps} cellImage="/wrist.jpg" />);
      const img = container.querySelector('img')!;
      expect(img.className).toContain('w-full');
      expect(img.className).toContain('h-full');
    });

    it('image uses object-cover to crop intelligently', () => {
      const { container } = render(<CalendarCell {...baseProps} cellImage="/wrist.jpg" />);
      const img = container.querySelector('img')!;
      expect(img.className).toContain('object-cover');
    });

    it('image uses object-center for balanced cropping', () => {
      const { container } = render(<CalendarCell {...baseProps} cellImage="/wrist.jpg" />);
      const img = container.querySelector('img')!;
      expect(img.className).toContain('object-center');
    });

    it('sets the correct src on the image', () => {
      const { container } = render(<CalendarCell {...baseProps} cellImage="/uploads/watch.jpg" />);
      const img = container.querySelector('img')!;
      expect(img.getAttribute('src')).toBe('/uploads/watch.jpg');
    });
  });

  describe('date badge — must be readable over images', () => {
    it('renders the day number', () => {
      const { getByText } = render(<CalendarCell {...baseProps} day={15} />);
      expect(getByText('15')).toBeInTheDocument();
    });

    it('date badge is absolutely positioned as an overlay', () => {
      const { container } = render(<CalendarCell {...baseProps} />);
      const badge = container.querySelector('span')!;
      expect(badge.className).toContain('absolute');
    });

    it('date badge has dark background over images for readability', () => {
      const { container } = render(<CalendarCell {...baseProps} cellImage="/wrist.jpg" />);
      const badge = container.querySelector('span')!;
      expect(badge.className).toMatch(/bg-black/);
      expect(badge.className).toContain('text-white');
    });

    it('date badge has no dark background when no image (uses text color only)', () => {
      const { container } = render(<CalendarCell {...baseProps} cellImage={null} />);
      const badge = container.querySelector('span')!;
      expect(badge.className).not.toMatch(/bg-black/);
    });

    it('today cell highlights the date badge in blue', () => {
      const { container } = render(<CalendarCell {...baseProps} isToday={true} cellImage={null} />);
      const badge = container.querySelector('span')!;
      expect(badge.className).toContain('text-blue-400');
    });
  });

  describe('cell link — navigation', () => {
    it('links to the correct day detail page', () => {
      const { container } = render(<CalendarCell {...baseProps} dateStr="2026-03-07" />);
      const link = container.querySelector('a')!;
      expect(link.getAttribute('href')).toBe('/day/2026-03-07');
    });

    it('today cell has a blue border', () => {
      const { container } = render(<CalendarCell {...baseProps} isToday={true} />);
      const link = container.querySelector('a')!;
      expect(link.className).toContain('border-blue-500');
    });

    it('non-today cell has a zinc border', () => {
      const { container } = render(<CalendarCell {...baseProps} isToday={false} />);
      const link = container.querySelector('a')!;
      expect(link.className).toContain('border-zinc-800');
    });
  });
});
