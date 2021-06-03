import { render } from '@testing-library/react';
import App from './App';

test('renders component', () => {
  const { getByText } = render(<App />);
  const textElement = getByText('closeWindowMsg');
  expect(textElement).toBeInTheDocument();
});