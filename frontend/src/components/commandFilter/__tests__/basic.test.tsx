import React from 'react';
import { render } from '@testing-library/react';

describe('Basic Test Setup', () => {
  test('React testing environment is working', () => {
    const TestComponent = () => <div>Test</div>;
    const { container } = render(<TestComponent />);
    expect(container.firstChild).toBeInTheDocument();
  });

  test('Math operations work correctly', () => {
    expect(1 + 1).toBe(2);
  });
});