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
  private server: Server;
  private wcagBasePath: string;
  private turndownService: any; // TurndownService instance

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
  private convertHtmlToMarkdown(html: string): string {
    return this.turndownService.turndown(html);
  }

  /**
   * Extract principles, guidelines, and success criteria from guidelines/index.html
   */
  private extractGuidelinesContent(html: string): string {
    try {
      console.error('[HTML] Extracting principles, guidelines, and success criteria');
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Create a new document fragment to hold our extracted content
      const fragment = document.createDocumentFragment();
      
      // Extract all principle sections
      const principles = document.querySelectorAll('section.principle');
      
      principles.forEach(principle => {
        // Clone the principle to avoid modifying the original
        const principleClone = principle.cloneNode(true);
        fragment.appendChild(principleClone);
      });
      
      // Create a new HTML document with just the extracted content
      const extractedHtml = `
        <html>
          <body>
            ${Array.from(fragment.childNodes).map(node => (node as Element).outerHTML).join('')}
          </body>
        </html>
      `;
      
      return extractedHtml;
    } catch (error) {
      console.error('[HTML] Error extracting content:', error);
      return html; // Return original HTML if extraction fails
    }
  }

  /**
   * Set up resource handlers for WCAG content
   */
  private setupResourceHandlers() {
    // Handler for listing static resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'wcag://principles-guidelines',
          name: 'WCAG Principles and Guidelines',
          mimeType: 'text/markdown',
          description: 'The principles and guidelines of WCAG',
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
          description: 'A specific WCAG success criterion',
        },
        {
          uriTemplate: 'wcag://understanding/{criterion-id}',
          name: 'WCAG Understanding Document',
          mimeType: 'text/markdown',
          description: 'Understanding document for a specific WCAG success criterion',
        },
        {
          uriTemplate: 'wcag://techniques/{technique-id}',
          name: 'WCAG Technique',
          mimeType: 'text/markdown',
          description: 'A specific WCAG technique',
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
          console.error('[Conversion] Extracting and converting principles and guidelines to Markdown');
          
          // Extract only the principles, guidelines, and success criteria
          const extractedHtml = this.extractGuidelinesContent(htmlContent);
          
          // Convert to Markdown
          const markdownContent = this.convertHtmlToMarkdown(extractedHtml);
          
          console.error(`[Conversion] Original HTML size: ${htmlContent.length} bytes`);
          console.error(`[Conversion] Extracted HTML size: ${extractedHtml.length} bytes`);
          console.error(`[Conversion] Markdown size: ${markdownContent.length} bytes`);
          console.error(`[Conversion] Size reduction: ${((htmlContent.length - markdownContent.length) / htmlContent.length * 100).toFixed(2)}%`);
          
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
  private async readPrinciplesAndGuidelines(): Promise<string> {
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
  private async findCriterion(criterionId: string): Promise<string> {
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
  private async findUnderstanding(criterionId: string): Promise<string> {
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
  private async findTechnique(techniqueId: string): Promise<string> {
    // Map of technique ID prefixes to technology directories
    const TECHNIQUE_PREFIX_MAP: Record<string, string> = {
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
