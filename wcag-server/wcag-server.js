#!/usr/bin/env node

/**
 * WCAG MCP Server
 * 
 * This server provides access to WCAG (Web Content Accessibility Guidelines) content
 * through MCP resources. It allows accessing:
 * - Principles and guidelines
 * - Success criteria
 * - Understanding documents
 * - Techniques
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import TurndownService from "turndown";
import { JSDOM } from "jsdom";

/**
 * WCAG MCP Server implementation
 */
class WcagServer {
  constructor() {
    // Get the WCAG path from environment variable or use default relative path
    this.wcagBasePath = process.env.WCAG_PATH || '../wcag';
    
    // Initialize Turndown service for HTML to Markdown conversion
    this.turndownService = new TurndownService({
      headingStyle: 'atx',       // Use # style headings
      codeBlockStyle: 'fenced',  // Use ``` style code blocks
      bulletListMarker: '-',     // Use - for bullet lists
      emDelimiter: '*',          // Use * for emphasis
      strongDelimiter: '**'      // Use ** for strong
    });
    
    // Create the MCP server
    this.server = new Server(
      {
        name: "wcag-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          resources: {},
        },
      }
    );

    // Set up resource handlers
    this.setupResourceHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
  }

  /**
   * Convert HTML to Markdown
   */
  convertHtmlToMarkdown(html) {
    return this.turndownService.turndown(html);
  }

  /**
   * Extract principles, guidelines, and success criteria from guidelines/index.html
   * and format them with links to each success criterion
   */
  extractGuidelinesContent(html) {
    try {
      console.error('[HTML] Extracting principles, guidelines, and success criteria');
      
      // Load criteria data
      let criteriaData = {};
      try {
        const criteriaPath = path.join(process.cwd(), 'wcag-criteria.json');
        console.error(`[Criteria] Loading criteria data from: ${criteriaPath}`);
        const criteriaJson = fs.readFileSync(criteriaPath, 'utf-8');
        criteriaData = JSON.parse(criteriaJson);
        console.error(`[Criteria] Loaded ${criteriaData.criteria?.length || 0} criteria`);
      } catch (err) {
        console.error('[Criteria] Error loading criteria data:', err);
        // Continue without criteria data
      }
      
      // Parse the HTML
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Build a formatted markdown output
      let markdown = '';
      
      // Process each principle
      const principles = document.querySelectorAll('section.principle');
      let principleNumber = 0;
      
      principles.forEach(principle => {
        principleNumber++;
        
        // Get principle title and description
        const principleTitle = principle.querySelector('h2')?.textContent?.trim() || '';
        const principleDescription = principle.querySelector('h2 + p')?.textContent?.trim() || '';
        
        // Add principle to markdown
        markdown += `## ${principleTitle}\n\n`;
        markdown += `${principleDescription}\n\n`;
        
        // Process each guideline within this principle
        const guidelines = principle.querySelectorAll('section.guideline');
        let guidelineNumber = 0;
        
        guidelines.forEach(guideline => {
          guidelineNumber++;
          
          // Get guideline title and description
          const guidelineTitle = guideline.querySelector('h3')?.textContent?.trim() || '';
          const guidelineDescription = guideline.querySelector('h3 + p')?.textContent?.trim() || '';
          
          // Add guideline to markdown
          markdown += `### ${guidelineTitle}\n\n`;
          markdown += `${guidelineDescription}\n\n`;
          
          // Process each success criterion within this guideline
          const criteria = guideline.querySelectorAll('section[data-include]');
          let criterionNumber = 0;
          
          criteria.forEach(criterion => {
            criterionNumber++;

            const includePath = criterion.getAttribute('data-include');
            const criterionId = includePath.split('/').pop().split('.')[0];

            console.error(`[Criterion] ID: ${criterionId}`);

            const scData = criteriaData.criteria?.find(c => c.id === criterionId);
            const scDom = new JSDOM(scData?.content || '');
            const sc = scDom.window.document.querySelector('section.sc');
            const scTitle = sc.querySelector('h4')?.textContent?.trim() || '';

            // Format the criterion number (e.g., 1.1.1)
            const criterionNumberFormatted = `${principleNumber}.${guidelineNumber}.${criterionNumber}`;
            
            // Add criterion to markdown with link
            markdown += `- [${criterionNumberFormatted} ${scTitle}](wcag://criteria/${criterionId})\n`;
          });
          
          markdown += '\n';
        });
      });
      
      return markdown;
    } catch (error) {
      console.error('[HTML] Error extracting content:', error);
      
      // Return a simple error message as markdown
      return `# Error Processing WCAG Guidelines\n\nAn error occurred while processing the WCAG guidelines: ${error}\n`;
    }
  }

  /**
   * Set up resource handlers for WCAG content
   */
  setupResourceHandlers() {
    // Handler for listing static resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'wcag://principles-guidelines',
          name: 'WCAG Principles and Guidelines',
          mimeType: 'text/markdown',
          description: 'The principles and guidelines of WCAG, including a hierarchical structure of principles, guidelines, and success criteria with their IDs. This resource provides all success criterion IDs needed for accessing specific criteria and understanding documents.',
        },
      ],
    }));

    // Handler for listing resource templates
    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      resourceTemplates: [
        {
          uriTemplate: 'wcag://criteria/{criterion-id}',
          name: 'WCAG Success Criterion',
          mimeType: 'text/markdown',
          description: 'A specific WCAG success criterion with detailed requirements. Note: You need to first check wcag://principles-guidelines to find the criterion ID you need.',
        },
        {
          uriTemplate: 'wcag://understanding/{criterion-id}',
          name: 'WCAG Understanding Document',
          mimeType: 'text/markdown',
          description: 'Understanding document for a specific WCAG success criterion, providing detailed explanations, examples, and implementation guidance. Note: You need to first check wcag://principles-guidelines to find the criterion ID you need.',
        },
        {
          uriTemplate: 'wcag://techniques/{technique-id}',
          name: 'WCAG Technique',
          mimeType: 'text/markdown',
          description: 'A specific WCAG technique that provides detailed implementation guidance for meeting success criteria. Techniques are categorized by technology (HTML, CSS, ARIA, etc.) and identified by prefixes in their IDs.',
        },
      ],
    }));

    // Handler for reading resources
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      try {
        console.error(`[Request] Reading resource: ${uri}`);
        
        // Handle principles and guidelines
        if (uri === 'wcag://principles-guidelines') {
          const htmlContent = await this.readPrinciplesAndGuidelines();
          console.error('[Conversion] Generating principles and guidelines with links to criteria');
          
          // Extract and format the content as markdown with links
          const markdownContent = this.extractGuidelinesContent(htmlContent);
          console.error(`[Conversion] Generated markdown content (${markdownContent.length} bytes)`);
          
          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: markdownContent,
              },
            ],
          };
        }
        
        // Handle success criteria
        const criteriaMatch = uri.match(/^wcag:\/\/criteria\/(.+)$/);
        if (criteriaMatch) {
          const [, criterionId] = criteriaMatch;
          console.error(`[Criteria] ID: ${criterionId}`);
          const htmlContent = await this.findCriterion(criterionId);
          
          // Convert to Markdown
          console.error('[Conversion] Converting success criterion to Markdown');
          const markdownContent = this.convertHtmlToMarkdown(htmlContent);
          
          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: markdownContent,
              },
            ],
          };
        }
        
        // Handle understanding documents
        const understandingMatch = uri.match(/^wcag:\/\/understanding\/(.+)$/);
        if (understandingMatch) {
          const [, criterionId] = understandingMatch;
          console.error(`[Understanding] ID: ${criterionId}`);
          const htmlContent = await this.findUnderstanding(criterionId);
          
          // Convert to Markdown
          console.error('[Conversion] Converting understanding document to Markdown');
          const markdownContent = this.convertHtmlToMarkdown(htmlContent);
          
          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: markdownContent,
              },
            ],
          };
        }
        
        // Handle techniques
        const techniqueMatch = uri.match(/^wcag:\/\/techniques\/([^/]+)$/);
        if (techniqueMatch) {
          const [, techniqueId] = techniqueMatch;
          console.error(`[Technique] ID: ${techniqueId}`);
          const htmlContent = await this.findTechnique(techniqueId);
          
          // Convert to Markdown
          console.error('[Conversion] Converting technique to Markdown');
          const markdownContent = this.convertHtmlToMarkdown(htmlContent);
          
          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: markdownContent,
              },
            ],
          };
        }
        
        throw new McpError(ErrorCode.InvalidRequest, `Invalid URI: ${uri}`);
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        console.error('[Error]', error);
        throw new McpError(
          ErrorCode.InternalError, 
          `Failed to read resource: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  /**
   * Read principles and guidelines from the WCAG repository
   */
  async readPrinciplesAndGuidelines() {
    try {
      const filePath = path.join(this.wcagBasePath, 'guidelines/index.html');
      console.error(`[File] Reading: ${filePath}`);
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      console.error(`[Error] Failed to read principles and guidelines: ${error}`);
      throw error;
    }
  }

  /**
   * Find a success criterion across all versions
   */
  async findCriterion(criterionId) {
    // Available versions
    const versions = ['20', '21', '22'];
    
    for (const version of versions) {
      try {
        const filePath = path.join(this.wcagBasePath, `guidelines/sc/${version}/${criterionId}.html`);
        console.error(`[File] Trying: ${filePath}`);
        
        if (fs.existsSync(filePath)) {
          console.error(`[File] Found criterion in version ${version}`);
          return fs.readFileSync(filePath, 'utf-8');
        }
      } catch (error) {
        console.error(`[Error] Error checking version ${version}: ${error}`);
        // Continue to next version
      }
    }
    
    // If we get here, the criterion was not found in any version
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Criterion not found: ${criterionId}`
    );
  }

  /**
   * Find an understanding document across all versions
   */
  async findUnderstanding(criterionId) {
    // Available versions
    const versions = ['20', '21', '22'];
    
    for (const version of versions) {
      try {
        const filePath = path.join(this.wcagBasePath, `understanding/${version}/${criterionId}.html`);
        console.error(`[File] Trying: ${filePath}`);
        
        if (fs.existsSync(filePath)) {
          console.error(`[File] Found understanding document in version ${version}`);
          return fs.readFileSync(filePath, 'utf-8');
        }
      } catch (error) {
        console.error(`[Error] Error checking version ${version}: ${error}`);
        // Continue to next version
      }
    }
    
    // If we get here, the understanding document was not found in any version
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Understanding document not found: ${criterionId}`
    );
  }

  /**
   * Find a technique based on its ID prefix
   */
  async findTechnique(techniqueId) {
    // Map of technique ID prefixes to technology directories
    const TECHNIQUE_PREFIX_MAP = {
      'ARIA': 'aria',
      'C': 'css',
      'F': 'failures',
      'FLASH': 'flash',
      'G': 'general',
      'H': 'html',
      'PDF': 'pdf',
      'SCR': 'client-side-script',
      'SL': 'silverlight',
      'SM': 'smil',
      'SVR': 'server-side-script',
      'T': 'text'
    };
    
    // Extract the prefix from the technique ID
    let prefix = '';
    if (techniqueId.startsWith('ARIA')) {
      prefix = 'ARIA';
    } else if (techniqueId.startsWith('FLASH')) {
      prefix = 'FLASH';
    } else if (techniqueId.startsWith('PDF')) {
      prefix = 'PDF';
    } else if (techniqueId.startsWith('SCR')) {
      prefix = 'SCR';
    } else if (techniqueId.startsWith('SL')) {
      prefix = 'SL';
    } else if (techniqueId.startsWith('SM')) {
      prefix = 'SM';
    } else if (techniqueId.startsWith('SVR')) {
      prefix = 'SVR';
    } else if (/^[A-Z]/.test(techniqueId)) {
      // If it starts with a capital letter, the first letter is the prefix
      prefix = techniqueId.charAt(0);
    } else {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid technique ID format: ${techniqueId}`
      );
    }
    
    // Look up the technology directory
    const technology = TECHNIQUE_PREFIX_MAP[prefix];
    if (!technology) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Unknown technique prefix: ${prefix}`
      );
    }
    
    console.error(`[Technique] Prefix: ${prefix}, Technology: ${technology}`);
    
    try {
      const filePath = path.join(this.wcagBasePath, `techniques/${technology}/${techniqueId}.html`);
      console.error(`[File] Reading: ${filePath}`);
      
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
      } else {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Technique not found: ${techniqueId}`
        );
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      console.error(`[Error] Failed to read technique: ${error}`);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to read technique: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Start the server
   */
  async run() {
    try {
      console.error('[Setup] Starting WCAG MCP server...');
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('[Setup] WCAG MCP server running on stdio');
    } catch (error) {
      console.error('[Setup] Failed to start server:', error);
      throw error;
    }
  }
}

// Create and run the server
const server = new WcagServer();
server.run().catch((error) => {
  console.error("[Fatal] Server error:", error);
  process.exit(1);
});
