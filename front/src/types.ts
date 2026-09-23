/**
 * Shared frontend types aligned with backend/app/schemas.py and AGENTS.md.
 * Catalog / teams / proposals live in the browser (see AGENTS.md); only constructor
 * AI endpoints exist on the server.
 */

/** @typedef {'need' | 'users' | 'data' | 'constraints' | 'result' | 'criteria' | 'contact'} QuestionField */
/** @typedef {'ai' | 'stub'} AiSource */
/** @typedef {'business' | 'student'} Role */
/** @typedef {'builder' | 'catalog' | 'proposals' | 'mine'} AppView */
/** @typedef {'pending' | 'accepted' | 'rejected'} ProposalStatus */

/**
 * @typedef {Object} Card
 * @property {string} title
 * @property {string} industry
 * @property {string} context
 * @property {string} need
 * @property {string} users
 * @property {string} data
 * @property {string} constraints
 * @property {string} result
 * @property {string} criteria
 * @property {string} contact
 * @property {string} format
 */

/**
 * @typedef {Object} Question
 * @property {QuestionField} field
 * @property {string} text
 */

/**
 * @typedef {Object} AnalyzeRequest
 * @property {string} draft
 * @property {string} [industry]
 */

/**
 * @typedef {Object} AnalyzeResponse
 * @property {Partial<Record<QuestionField, boolean>>} detected
 * @property {QuestionField[]} missing
 * @property {Question[]} questions
 * @property {AiSource} source
 */

/**
 * @typedef {Object} BuildCardRequest
 * @property {string} draft
 * @property {string} [industry]
 * @property {Partial<Record<QuestionField, string>>} answers
 */

/**
 * @typedef {Object} BuildCardResponse
 * @property {Card} card
 * @property {string[]} warnings
 * @property {AiSource} source
 */

/**
 * @typedef {Object} HealthResponse
 * @property {boolean} ok
 * @property {string} ai_mode
 * @property {boolean} ai_available
 * @property {boolean} openai_key
 * @property {string} model
 */

/**
 * @typedef {Object} ApiErrorBody
 * @property {string} error
 */

/**
 * @typedef {Card & {
 *   id: string,
 *   company: string,
 *   tags: string[],
 *   createdAt: number,
 *   owner?: boolean,
 *   isNew?: boolean,
 *   score?: number,
 * }} Task
 */

/**
 * @typedef {Object} Team
 * @property {string} id
 * @property {string} name
 * @property {string} captain
 * @property {number} members
 * @property {string[]} skills
 * @property {string[]} interests
 * @property {number} points
 */

/**
 * @typedef {Object} Proposal
 * @property {string} id
 * @property {string} taskId
 * @property {string} teamId
 * @property {ProposalStatus} status
 * @property {string} idea
 * @property {string} plan
 * @property {string} deadline
 * @property {string} link
 */

/**
 * @typedef {Object} Company
 * @property {string} id
 * @property {string} name
 * @property {string} contactName
 * @property {string} roleLabelKey
 */

export {}
