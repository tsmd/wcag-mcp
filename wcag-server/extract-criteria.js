#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { JSDOM } from 'jsdom';

/**
 * Extract success criteria from WCAG repository
 * This script scans all HTML files in the guidelines/sc directory,
 * extracts information about each success criterion, and outputs a JSON file.
 */
async function extractCriteria() {
  console.error('[Extract] Starting extraction of WCAG success criteria');
  
  try {
    // Get the base directory (assuming this script is in wcag-server)
    const baseDir = path.resolve(process.cwd(), '../wcag');
    console.error(`[Extract] Base directory: ${baseDir}`);
    
    // Find all success criteria files
    const pattern = path.join(baseDir, 'guidelines/sc/*/*.html');
    console.error(`[Extract] Searching for files matching pattern: ${pattern}`);
    
    const files = await glob(pattern);
    console.error(`[Extract] Found ${files.length} files`);
    
    // Array to store all criteria
    const criteria = [];
    
    // Process each file
    for (const file of files) {
      try {
        // Extract version from directory name
        const dirMatch = file.match(/guidelines\/sc\/(\d+)\//);
        const version = dirMatch ? dirMatch[1] : 'unknown';
        
        // Read file content
        const content = await fs.readFile(file, 'utf-8');
        
        // Parse HTML
        const dom = new JSDOM(content);
        const document = dom.window.document;
        
        // Extract information
        const section = document.querySelector('section');
        if (!section) {
          console.error(`[Extract] Warning: No section found in ${file}`);
          continue;
        }
        
        const id = section.id || path.basename(file, '.html');
        const title = document.querySelector('h4')?.textContent?.trim() || '';
        const levelElement = document.querySelector('.conformance-level');
        const level = levelElement?.textContent?.trim() || '';
        
        // Add to criteria array
        criteria.push({
          id,
          version,
          level,
          title,
          content: content.trim()
        });
        
        console.error(`[Extract] Processed: ${id} (${version}) - ${title} [${level}]`);
      } catch (err) {
        console.error(`[Extract] Error processing file ${file}:`, err);
      }
    }
    
    // Sort criteria by version and id
    criteria.sort((a, b) => {
      if (a.version !== b.version) {
        return a.version.localeCompare(b.version);
      }
      return a.id.localeCompare(b.id);
    });
    
    // Create output JSON
    const output = {
      criteria,
      count: criteria.length,
      generatedAt: new Date().toISOString()
    };
    
    // Write to file
    const outputPath = path.join(process.cwd(), 'wcag-criteria.json');
    await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    
    console.error(`[Extract] Successfully wrote ${criteria.length} criteria to ${outputPath}`);
    
    // Output summary to stdout
    console.log(JSON.stringify({
      status: 'success',
      count: criteria.length,
      outputPath
    }));
    
  } catch (err) {
    console.error('[Extract] Fatal error:', err);
    process.exit(1);
  }
}

// Run the extraction
extractCriteria();
