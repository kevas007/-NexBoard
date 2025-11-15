import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'

describe('Card', () => {
  it('renders with children', () => {
    render(
      <Card>
        <div>Card content</div>
      </Card>
    )
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('applies default classes', () => {
    render(<Card>Test</Card>)
    const card = screen.getByText('Test').closest('div')
    expect(card).toHaveClass('bg-white', 'dark:bg-slate-900', 'rounded-2xl', 'shadow-sm')
  })

  it('applies custom className', () => {
    render(<Card className="custom-class">Test</Card>)
    const card = screen.getByText('Test').closest('div')
    expect(card).toHaveClass('custom-class')
  })

  it('applies custom className', () => {
    render(<Card className="custom-class">Test</Card>)
    const card = screen.getByText('Test').closest('div')
    expect(card).toHaveClass('custom-class')
  })
})

describe('CardHeader', () => {
  it('renders with children', () => {
    render(
      <CardHeader>
        <div>Header content</div>
      </CardHeader>
    )
    expect(screen.getByText('Header content')).toBeInTheDocument()
  })

  it('applies default classes', () => {
    render(<CardHeader>Test</CardHeader>)
    const header = screen.getByText('Test').closest('div')
    expect(header).toHaveClass('flex', 'flex-col', 'space-y-1.5', 'p-6')
  })
})

describe('CardTitle', () => {
  it('renders with children', () => {
    render(<CardTitle>Test Title</CardTitle>)
    expect(screen.getByText('Test Title')).toBeInTheDocument()
  })

  it('applies default classes', () => {
    render(<CardTitle>Test</CardTitle>)
    const title = screen.getByText('Test').closest('h3')
    expect(title).toHaveClass('text-lg', 'font-semibold', 'text-slate-900', 'dark:text-slate-100')
  })
})

describe('CardContent', () => {
  it('renders with children', () => {
    render(
      <CardContent>
        <div>Content</div>
      </CardContent>
    )
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('applies default classes', () => {
    render(<CardContent>Test</CardContent>)
    const content = screen.getByText('Test').closest('div')
    expect(content).toHaveClass('p-6')
  })
})
