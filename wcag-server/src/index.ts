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

/**
 * WCAG MCP Server implementation
 */
class WcagServer {
  private server: Server;
  private wcagBasePath: string;

  constructor() {
    // Get the WCAG path from environment variable or use default relative path
    this.wcagBasePath = process.env.WCAG_PATH || '../wcag';
    
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
   * Set up resource handlers for WCAG content
   */
  private setupResourceHandlers() {
    // Handler for listing static resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'wcag://principles-guidelines',
          name: 'WCAG Principles and Guidelines',
          mimeType: 'text/html',
          description: 'The principles and guidelines of WCAG',
        },
      ],
    }));

    // Handler for listing resource templates
    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      resourceTemplates: [
        {
          uriTemplate: 'wcag://criteria/{version}/{criterion-id}',
          name: 'WCAG Success Criterion',
          mimeType: 'text/html',
          description: 'A specific WCAG success criterion',
        },
        {
          uriTemplate: 'wcag://understanding/{version}/{criterion-id}',
          name: 'WCAG Understanding Document',
          mimeType: 'text/html',
          description: 'Understanding document for a specific WCAG success criterion',
        },
        {
          uriTemplate: 'wcag://techniques/{technology}/{technique-id}',
          name: 'WCAG Technique',
          mimeType: 'text/html',
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
          const content = await this.readPrinciplesAndGuidelines();
          return {
            contents: [
              {
                uri,
                mimeType: 'text/html',
                text: content,
              },
            ],
          };
        }
        
        // Handle success criteria
        const criteriaMatch = uri.match(/^wcag:\/\/criteria\/(\d+)\/(.+)$/);
        if (criteriaMatch) {
          const [, version, criterionId] = criteriaMatch;
          console.error(`[Criteria] Version: ${version}, ID: ${criterionId}`);
          const content = await this.readCriterion(version, criterionId);
          return {
            contents: [
              {
                uri,
                mimeType: 'text/html',
                text: content,
              },
            ],
          };
        }
        
        // Handle understanding documents
        const understandingMatch = uri.match(/^wcag:\/\/understanding\/(\d+)\/(.+)$/);
        if (understandingMatch) {
          const [, version, criterionId] = understandingMatch;
          console.error(`[Understanding] Version: ${version}, ID: ${criterionId}`);
          const content = await this.readUnderstanding(version, criterionId);
          return {
            contents: [
              {
                uri,
                mimeType: 'text/html',
                text: content,
              },
            ],
          };
        }
        
        // Handle techniques
        const techniqueMatch = uri.match(/^wcag:\/\/techniques\/([^/]+)\/([^/]+)$/);
        if (techniqueMatch) {
          const [, technology, techniqueId] = techniqueMatch;
          console.error(`[Technique] Technology: ${technology}, ID: ${techniqueId}`);
          const content = await this.readTechnique(technology, techniqueId);
          return {
            contents: [
              {
                uri,
                mimeType: 'text/html',
                text: content,
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
   * Read a success criterion from the WCAG repository
   */
  private async readCriterion(version: string, criterionId: string): Promise<string> {
    try {
      const filePath = path.join(this.wcagBasePath, `guidelines/sc/${version}/${criterionId}.html`);
      console.error(`[File] Reading: ${filePath}`);
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      console.error(`[Error] Failed to read criterion: ${error}`);
      throw error;
    }
  }

  /**
   * Read an understanding document from the WCAG repository
   */
  private async readUnderstanding(version: string, criterionId: string): Promise<string> {
    try {
      const filePath = path.join(this.wcagBasePath, `understanding/${version}/${criterionId}.html`);
      console.error(`[File] Reading: ${filePath}`);
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      console.error(`[Error] Failed to read understanding document: ${error}`);
      throw error;
    }
  }

  /**
   * Read a technique from the WCAG repository
   */
  private async readTechnique(technology: string, techniqueId: string): Promise<string> {
    try {
      const filePath = path.join(this.wcagBasePath, `techniques/${technology}/${techniqueId}.html`);
      console.error(`[File] Reading: ${filePath}`);
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      console.error(`[Error] Failed to read technique: ${error}`);
      throw error;
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
