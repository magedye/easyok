/**
 * Governance Validator - Enforces frontend governance rules
 * 
 * This utility provides lint-like checks during development to ensure
 * compliance with the 10 hard governance rules outlined in the handoff.
 * 
 * Supports override mechanism for legitimate edge cases with:
 * - Required reason for override
 * - Optional expiry date
 * - Optional approval tracking
 * - CI validation of overrides
 */

/**
 * Governance rule violation details
 */
export interface Violation {
  rule: string;
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning';
  suggestion?: string;
}

/**
 * Governance override directive
 * Usage: // @governance-ignore-next-line rule=no-sql-generation reason="Display only"
 */
export interface GovernanceIgnore {
  rule: string;
  reason: string;
  approved_by?: string;
  expires?: string; // ISO date string
  line?: number;
}

/**
 * Validation result with violations and override status
 */
export interface GovernanceValidationResult {
  violations: Violation[];
  overrides: GovernanceIgnore[];
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * The 10 Hard Governance Rules from the handoff specification
 */
export enum GovernanceRule {
  NO_SQL_GENERATION = 'no-sql-generation',
  NO_PERMISSION_INFERENCE = 'no-permission-inference', 
  NO_RLS_LOGIC = 'no-rls-logic',
  NO_CACHING_LOGIC = 'no-caching-logic',
  NO_ASSUMPTION_INFERENCE = 'no-assumption-inference',
  NO_SECRET_STORAGE = 'no-secret-storage',
  NO_RESPONSE_REORDERING = 'no-response-reordering',
  NO_UNAUTHORIZED_MUTATION = 'no-unauthorized-mutation',
  NO_POLICY_CACHING = 'no-policy-caching',
  NO_HARDCODED_ENV_ASSUMPTIONS = 'no-hardcoded-env-assumptions'
}

/**
 * Patterns to detect for each governance rule
 */
const RULE_PATTERNS: Record<GovernanceRule, Array<{ pattern: RegExp; message: string; suggestion?: string }>> = {
  [GovernanceRule.NO_SQL_GENERATION]: [
    {
      pattern: /(?:SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+/gi,
      message: 'Direct SQL keywords detected - frontend must not generate SQL',
      suggestion: 'Use backend API endpoints instead of generating SQL'
    },
    {
      pattern: /sql\s*=\s*["`'].*["`']/gi,
      message: 'SQL string construction detected',
      suggestion: 'SQL generation must happen in backend only'
    }
  ],

  [GovernanceRule.NO_PERMISSION_INFERENCE]: [
    {
      pattern: /(?:hasPermission|checkPermission|canAccess|isAllowed|authorize)/gi,
      message: 'Permission checking logic detected - backend decides permissions',
      suggestion: 'Rely on backend API responses instead of local permission checks'
    },
    {
      pattern: /role\s*===?\s*["`']admin["`']/gi,
      message: 'Role-based logic detected in frontend',
      suggestion: 'Backend should determine access, frontend should only display'
    }
  ],

  [GovernanceRule.NO_RLS_LOGIC]: [
    {
      pattern: /(?:row.+level|RLS|tenant.+filter|data.+filter)/gi,
      message: 'Row-level security logic detected - backend responsibility',
      suggestion: 'Backend handles all data filtering and security'
    }
  ],

  [GovernanceRule.NO_CACHING_LOGIC]: [
    {
      pattern: /(?:cache|Cache)\.(set|get|put|store)/gi,
      message: 'Custom caching logic detected - use documented cache patterns only',
      suggestion: 'Follow backend caching strategy or use browser cache headers'
    },
    {
      pattern: /localStorage\.setItem.*(?:query|result|data)/gi,
      message: 'Manual data caching to localStorage detected',
      suggestion: 'Use sessionStorage for session data only, not for caching business data'
    }
  ],

  [GovernanceRule.NO_ASSUMPTION_INFERENCE]: [
    {
      pattern: /assumptions?\.(add|push|modify|update)/gi,
      message: 'Assumption modification detected - assumptions come from backend only',
      suggestion: 'Display assumptions as read-only from technical_view chunk'
    }
  ],

  [GovernanceRule.NO_SECRET_STORAGE]: [
    {
      pattern: /localStorage\.setItem.*(?:token|secret|key|password|auth)/gi,
      message: 'Secrets stored in localStorage - use sessionStorage only',
      suggestion: 'Use sessionStorage for tokens to clear on browser close'
    },
    {
      pattern: /document\.cookie.*(?:token|secret|key)/gi,
      message: 'Secrets stored in cookies without proper security',
      suggestion: 'Use httpOnly cookies set by backend, or sessionStorage'
    }
  ],

  [GovernanceRule.NO_RESPONSE_REORDERING]: [
    {
      pattern: /chunks?\.(sort|reverse|reorder)/gi,
      message: 'Stream chunk reordering detected - preserve backend order',
      suggestion: 'Process chunks in received order using StreamValidator'
    },
    {
      pattern: /\.sort\(\s*\(.*chunk.*type.*\)/gi,
      message: 'Chunk sorting by type detected',
      suggestion: 'Backend guarantees correct chunk order - do not reorder'
    }
  ],

  [GovernanceRule.NO_UNAUTHORIZED_MUTATION]: [
    {
      pattern: /setState.*before.*fetch/gi,
      message: 'Optimistic UI update detected - wait for backend confirmation',
      suggestion: 'Update UI state only after successful backend response'
    },
    {
      pattern: /(?:create|update|delete).*optimistic/gi,
      message: 'Optimistic mutation pattern detected',
      suggestion: 'All mutations must be confirmed by backend before UI update'
    }
  ],

  [GovernanceRule.NO_POLICY_CACHING]: [
    {
      pattern: /policy.*(?:cache|Cache|store)/gi,
      message: 'Policy caching logic detected - policies change dynamically',
      suggestion: 'Fetch fresh policy data for each request'
    }
  ],

  [GovernanceRule.NO_HARDCODED_ENV_ASSUMPTIONS]: [
    {
      pattern: /(?:process\.env|import\.meta\.env)\.(?!VITE_)/gi,
      message: 'Non-Vite environment variable usage detected',
      suggestion: 'Use runtime environment detection instead of build-time assumptions'
    },
    {
      pattern: /(?:localhost|127\.0\.0\.1|staging\.|prod\.).*hardcode/gi,
      message: 'Hardcoded environment URL detected',
      suggestion: 'Use environment detection to get runtime configuration'
    }
  ]
};

/**
 * GovernanceValidator class with override support
 */
export class GovernanceValidator {
  private overrides: Map<string, GovernanceIgnore[]> = new Map();

  /**
   * Parse governance ignore directives from code
   * Looks for comments like: // @governance-ignore-next-line rule=no-sql-generation reason="Read-only display"
   */
  parseGovernanceIgnores(content: string, filename: string): GovernanceIgnore[] {
    const ignores: GovernanceIgnore[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ignoreMatch = line.match(/@governance-ignore-next-line\s+(.+)/);
      
      if (ignoreMatch) {
        const directiveText = ignoreMatch[1];
        const ruleMatch = directiveText.match(/rule=([^\s]+)/);
        const reasonMatch = directiveText.match(/reason="([^"]+)"/);
        const approvedByMatch = directiveText.match(/approved_by="([^"]+)"/);
        const expiresMatch = directiveText.match(/expires="([^"]+)"/);

        if (ruleMatch && reasonMatch) {
          ignores.push({
            rule: ruleMatch[1],
            reason: reasonMatch[1],
            approved_by: approvedByMatch?.[1],
            expires: expiresMatch?.[1],
            line: i + 2 // Next line
          });
        }
      }
    }

    this.overrides.set(filename, ignores);
    return ignores;
  }

  /**
   * Validate governance overrides
   * Checks for expired overrides, missing reasons, etc.
   */
  validateOverrides(ignores: GovernanceIgnore[]): string[] {
    const errors: string[] = [];
    const now = new Date();

    for (const ignore of ignores) {
      // Check for required reason
      if (!ignore.reason || ignore.reason.trim().length < 10) {
        errors.push(`Override for rule "${ignore.rule}" needs detailed reason (min 10 chars)`);
      }

      // Check for expiry
      if (ignore.expires) {
        const expiryDate = new Date(ignore.expires);
        if (isNaN(expiryDate.getTime())) {
          errors.push(`Override for rule "${ignore.rule}" has invalid expiry date: ${ignore.expires}`);
        } else if (expiryDate < now) {
          errors.push(`Override for rule "${ignore.rule}" has expired: ${ignore.expires}`);
        }
      }

      // Check for valid rule name
      if (!Object.values(GovernanceRule).includes(ignore.rule as GovernanceRule)) {
        errors.push(`Override for unknown rule: "${ignore.rule}"`);
      }
    }

    return errors;
  }

  /**
   * Check if line has valid override
   */
  private hasValidOverride(filename: string, line: number, rule: GovernanceRule): boolean {
    const fileOverrides = this.overrides.get(filename) || [];
    return fileOverrides.some(override => 
      override.line === line && 
      override.rule === rule &&
      (!override.expires || new Date(override.expires) > new Date())
    );
  }

  /**
   * Validate code against specific governance rule
   */
  private validateRule(content: string, filename: string, rule: GovernanceRule): Violation[] {
    const violations: Violation[] = [];
    const patterns = RULE_PATTERNS[rule];
    const lines = content.split('\n');

    for (const { pattern, message, suggestion } of patterns) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const matches = line.matchAll(new RegExp(pattern.source, pattern.flags));

        for (const match of matches) {
          const lineNumber = i + 1;
          
          // Check if this line has a valid override
          if (this.hasValidOverride(filename, lineNumber, rule)) {
            continue; // Skip this violation due to valid override
          }

          violations.push({
            rule,
            message,
            line: lineNumber,
            column: match.index,
            severity: 'error',
            suggestion
          });
        }
      }
    }

    return violations;
  }

  /**
   * Validate entire file against all governance rules
   */
  validateFile(content: string, filename: string): GovernanceValidationResult {
    // Parse overrides first
    const overrides = this.parseGovernanceIgnores(content, filename);
    const overrideErrors = this.validateOverrides(overrides);

    // Run rule validation
    const allViolations: Violation[] = [];
    for (const rule of Object.values(GovernanceRule)) {
      const violations = this.validateRule(content, filename, rule);
      allViolations.push(...violations);
    }

    const errors = overrideErrors.concat(
      allViolations.filter(v => v.severity === 'error').map(v => v.message)
    );

    const warnings = allViolations.filter(v => v.severity === 'warning').map(v => v.message);

    return {
      violations: allViolations,
      overrides,
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate specific rule against code
   */
  checkRule(content: string, rule: GovernanceRule): Violation[] {
    return this.validateRule(content, 'inline-check', rule);
  }

  /**
   * Get rule suggestions for violation
   */
  getRuleSuggestion(rule: GovernanceRule): string {
    const patterns = RULE_PATTERNS[rule];
    return patterns[0]?.suggestion || 'Follow governance guidelines for this rule';
  }

  /**
   * Generate governance report for multiple files
   */
  generateReport(files: Array<{ filename: string; content: string }>): {
    totalFiles: number;
    validFiles: number;
    totalViolations: number;
    totalOverrides: number;
    fileResults: Array<{ filename: string } & GovernanceValidationResult>;
  } {
    const results = files.map(({ filename, content }) => ({
      filename,
      ...this.validateFile(content, filename)
    }));

    return {
      totalFiles: files.length,
      validFiles: results.filter(r => r.isValid).length,
      totalViolations: results.reduce((sum, r) => sum + r.violations.length, 0),
      totalOverrides: results.reduce((sum, r) => sum + r.overrides.length, 0),
      fileResults: results
    };
  }

  /**
   * Get CI-friendly output format
   */
  getCIOutput(result: GovernanceValidationResult, filename: string): string {
    const lines: string[] = [];
    
    for (const violation of result.violations) {
      lines.push(
        `${filename}:${violation.line}:${violation.column}: ` +
        `${violation.severity}: ${violation.message} (${violation.rule})`
      );
      if (violation.suggestion) {
        lines.push(`  💡 ${violation.suggestion}`);
      }
    }

    for (const error of result.errors) {
      lines.push(`${filename}: error: ${error}`);
    }

    return lines.join('\n');
  }

  /**
   * Reset validator state
   */
  reset(): void {
    this.overrides.clear();
  }
}