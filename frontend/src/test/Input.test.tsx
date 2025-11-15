import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '../components/ui/Input'

describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Test Label" />)
    expect(screen.getByLabelText(/test label/i)).toBeInTheDocument()
  })

  it('renders with placeholder', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText(/enter text/i)).toBeInTheDocument()
  })

  it('handles value changes', async () => {
    const handleChange = vi.fn()
    const user = userEvent.setup()

    render(<Input onChange={handleChange} />)

    const input = screen.getByRole('textbox')
    await user.type(input, 'test')

    expect(handleChange).toHaveBeenCalled()
  })

  it('can be disabled', () => {
    render(<Input disabled />)
    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
  })

  it('shows error state', () => {
    render(<Input error="This field is required" />)
    expect(screen.getByText(/this field is required/i)).toBeInTheDocument()
  })

  it('applies different input types', () => {
    render(<Input type="email" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('type', 'email')
  })

  it('shows required indicator', () => {
    render(<Input label="Required Field" required />)
    const input = screen.getByLabelText('Required Field')
    expect(input).toHaveAttribute('required')
  })

  it('applies custom className', () => {
    render(<Input className="custom-class" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('custom-class')
  })

  it('applies custom className', () => {
    render(<Input className="custom-class" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('custom-class')
  })

  it('handles focus and blur events', async () => {
    const handleFocus = vi.fn()
    const handleBlur = vi.fn()
    const user = userEvent.setup()

    render(<Input onFocus={handleFocus} onBlur={handleBlur} />)

    const input = screen.getByRole('textbox')
    await user.click(input)
    expect(handleFocus).toHaveBeenCalled()

    await user.tab()
    expect(handleBlur).toHaveBeenCalled()
  })
})
