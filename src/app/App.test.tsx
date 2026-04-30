import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the main workbench regions', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'AI 出图工作台' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '创作下一轮' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Provider' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '当前结果' })).toBeInTheDocument();
  });
});
