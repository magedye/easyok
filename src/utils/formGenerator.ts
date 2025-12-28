/**
 * Form Generator Utility
 * Auto-generates form fields from JSON schemas
 */

import type { SchemaProperty, JsonSchema, FormField } from '@/types/apiCatalog'

/**
 * Convert JSON Schema to FormField definitions
 */
export function schemaToFormFields(schema: JsonSchema, prefix = ''): FormField[] {
  const fields: FormField[] = []

  if (!schema.properties) {
    return fields
  }

  Object.entries(schema.properties).forEach(([fieldName, property]) => {
    const fullName = prefix ? `${prefix}.${fieldName}` : fieldName
    const isRequired = schema.required?.includes(fieldName) ?? false

    const field = propertyToFormField(fieldName, property, isRequired, fullName)
    fields.push(field)

    // Handle nested objects
    if (property.type === 'object' && property.properties) {
      const nestedSchema: JsonSchema = {
        type: 'object',
        properties: property.properties,
        required: Array.isArray(property.required) ? property.required : undefined,
      }
      const nestedFields = schemaToFormFields(nestedSchema, fullName)
      fields.push(...nestedFields)
    }
  })

  return fields
}

/**
 * Convert a single schema property to a FormField
 */
function propertyToFormField(
  name: string,
  property: SchemaProperty,
  required: boolean,
  fullName: string
): FormField {
  const baseField = {
    name: fullName,
    type: 'text' as const,
    label: formatLabel(name),
    description: property.description,
    required,
  }

  // Determine field type based on schema property type
  switch (property.type) {
    case 'string':
      if (name.toLowerCase().includes('email')) {
        return { ...baseField, type: 'email' }
      }
      if (name.toLowerCase().includes('password') || name.toLowerCase().includes('token')) {
        return { ...baseField, type: 'password' }
      }
      if (property.enum && property.enum.length > 0) {
        return {
          ...baseField,
          type: 'select',
          options: property.enum.map((val) => ({
            label: String(val),
            value: val,
          })),
        }
      }
      if (property.minLength || property.maxLength || property.pattern) {
        return {
          ...baseField,
          type: 'textarea',
          validation: {
            minLength: property.minLength,
            maxLength: property.maxLength,
            pattern: property.pattern,
          },
        }
      }
      return { ...baseField, type: 'text', placeholder: `Enter ${formatLabel(name).toLowerCase()}` }

    case 'number':
      return {
        ...baseField,
        type: 'number',
        validation: {
          minimum: property.minimum,
          maximum: property.maximum,
        },
      }

    case 'integer':
      return {
        ...baseField,
        type: 'number',
        validation: {
          minimum: property.minimum,
          maximum: property.maximum,
        },
      }

    case 'boolean':
      return { ...baseField, type: 'checkbox' }

    case 'array':
      // For arrays, check the item type
      if (property.items?.type === 'string') {
        return {
          ...baseField,
          type: 'text',
          placeholder: 'Enter comma-separated values',
          validation: {
            custom: (value) => {
              if (typeof value === 'string') {
                return value.split(',').length > 0 || 'Enter at least one value'
              }
              return Array.isArray(value) && value.length > 0 ? true : 'Enter at least one value'
            },
          },
        }
      }
      return { ...baseField, type: 'json', placeholder: 'Enter JSON array' }

    case 'object':
      return { ...baseField, type: 'json', placeholder: 'Enter JSON object' }

    default:
      return { ...baseField, type: 'text' }
  }
}

/**
 * Format a field name to a readable label
 * e.g., "firstName" → "First Name", "user_email" → "User Email"
 */
export function formatLabel(name: string): string {
  return (
    name
      // Convert camelCase to words
      .replace(/([A-Z])/g, ' $1')
      // Convert snake_case to spaces
      .replace(/_/g, ' ')
      // Capitalize first letter of each word
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim()
  )
}

/**
 * Validate form data against a JSON schema
 */
export function validateFormData(
  data: Record<string, unknown>,
  schema: JsonSchema
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  if (!schema.properties) {
    return { valid: true, errors }
  }

  Object.entries(schema.properties).forEach(([fieldName, property]) => {
    const value = data[fieldName]

    // Check required
    if (schema.required?.includes(fieldName) && (value === undefined || value === null || value === '')) {
      errors[fieldName] = `${formatLabel(fieldName)} is required`
      return
    }

    // Skip validation if not required and empty
    if (!schema.required?.includes(fieldName) && (value === undefined || value === null || value === '')) {
      return
    }

    // Type validation
    const typeError = validateType(value, property)
    if (typeError) {
      errors[fieldName] = typeError
      return
    }

    // String validations
    if (property.type === 'string' && typeof value === 'string') {
      if (property.minLength && value.length < property.minLength) {
        errors[fieldName] = `Minimum ${property.minLength} characters`
      }
      if (property.maxLength && value.length > property.maxLength) {
        errors[fieldName] = `Maximum ${property.maxLength} characters`
      }
      if (property.pattern && !new RegExp(property.pattern).test(value)) {
        errors[fieldName] = `Invalid format`
      }
    }

    // Number validations
    if ((property.type === 'number' || property.type === 'integer') && typeof value === 'number') {
      if (property.minimum !== undefined && value < property.minimum) {
        errors[fieldName] = `Minimum value is ${property.minimum}`
      }
      if (property.maximum !== undefined && value > property.maximum) {
        errors[fieldName] = `Maximum value is ${property.maximum}`
      }
    }

    // Enum validation
    if (property.enum && !property.enum.includes(value as string | number)) {
      errors[fieldName] = `Must be one of: ${property.enum.join(', ')}`
    }
  })

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Validate the type of a value
 */
function validateType(value: unknown, property: SchemaProperty): string | null {
  if (value === null || value === undefined) {
    return null
  }

  const actualType = Array.isArray(value) ? 'array' : typeof value

  switch (property.type) {
    case 'string':
      return actualType === 'string' ? null : `Expected string, got ${actualType}`
    case 'number':
      return actualType === 'number' ? null : `Expected number, got ${actualType}`
    case 'integer':
      return Number.isInteger(value) ? null : `Expected integer, got ${actualType}`
    case 'boolean':
      return actualType === 'boolean' ? null : `Expected boolean, got ${actualType}`
    case 'array':
      return actualType === 'array' ? null : `Expected array, got ${actualType}`
    case 'object':
      return actualType === 'object' ? null : `Expected object, got ${actualType}`
    default:
      return null
  }
}

/**
 * Transform form data (e.g., convert string arrays to arrays)
 */
export function transformFormData(
  data: Record<string, unknown>,
  schema: JsonSchema
): Record<string, unknown> {
  const transformed: Record<string, unknown> = { ...data }

  if (!schema.properties) {
    return transformed
  }

  Object.entries(schema.properties).forEach(([fieldName, property]) => {
    const value = transformed[fieldName]

    if (value === undefined || value === null) {
      return
    }

    // Transform arrays
    if (property.type === 'array' && typeof value === 'string') {
      transformed[fieldName] = value.split(',').map((item) => item.trim())
    }

    // Parse JSON
    if ((property.type === 'object' || property.type === 'array') && typeof value === 'string') {
      try {
        transformed[fieldName] = JSON.parse(value)
      } catch {
        // Keep as string if parsing fails
      }
    }

    // Parse numbers
    if ((property.type === 'number' || property.type === 'integer') && typeof value === 'string') {
      const num = Number(value)
      if (!isNaN(num)) {
        transformed[fieldName] = num
      }
    }
  })

  return transformed
}

/**
 * Generate example data from a schema for demo/preview purposes
 */
export function generateExampleData(schema: JsonSchema): Record<string, unknown> {
  const example: Record<string, unknown> = {}

  if (!schema.properties) {
    return example
  }

  Object.entries(schema.properties).forEach(([fieldName, property]) => {
    example[fieldName] = generateExampleValue(property)
  })

  return example
}

/**
 * Generate an example value for a schema property
 */
function generateExampleValue(property: SchemaProperty): unknown {
  if (property.default !== undefined) {
    return property.default
  }

  if (property.enum && property.enum.length > 0) {
    return property.enum[0]
  }

  switch (property.type) {
    case 'string':
      return 'example'
    case 'number':
      return 42.5
    case 'integer':
      return 42
    case 'boolean':
      return true
    case 'array':
      return [generateExampleValue(property.items || { type: 'string' })]
    case 'object':
      return {}
    default:
      return null
  }
}
