#!/usr/bin/env node

/**
 * Generate a formatted Markdown file with principles, guidelines, and success criteria
 * with links to each criterion in the format wcag://criteria/{criterion-id}
 */

import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

// Paths
const wcagBasePath = '../wcag';
const guidelinesPath = path.join(wcagBasePath, 'guidelines/index.html');
const outputPath = 'principles-guidelines.md';

/**
 * Extract principles, guidelines, and success criteria from guidelines/index.html
 * and format them with links to each success criterion
 */
function extractGuidelinesContent(html) {
  try {
    console.log('[HTML] Extracting principles, guidelines, and success criteria');
    
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
        const criteria = guideline.querySelectorAll('section[id]');
        let criterionNumber = 0;
        
        criteria.forEach(criterion => {
          criterionNumber++;
          
          // Get criterion ID and title
          const criterionId = criterion.id;
          const criterionTitle = criterion.querySelector('h4')?.textContent?.trim() || '';
          
          // Format the criterion number (e.g., 1.1.1)
          const criterionNumberFormatted = `${principleNumber}.${guidelineNumber}.${criterionNumber}`;
          
          // Add criterion to markdown with link
          markdown += `- [${criterionNumberFormatted} ${criterionTitle}](wcag://criteria/${criterionId})\n`;
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

// Main function
async function main() {
  try {
    console.log(`Reading guidelines from ${guidelinesPath}`);
    const htmlContent = fs.readFileSync(guidelinesPath, 'utf-8');
    
    console.log('Extracting and formatting content');
    const markdownContent = extractGuidelinesContent(htmlContent);
    
    console.log(`Writing output to ${outputPath}`);
    fs.writeFileSync(outputPath, markdownContent, 'utf-8');
    
    console.log('Done!');
    console.log(`Output file: ${path.resolve(outputPath)}`);
    
    // Print a preview
    const preview = markdownContent.substring(0, 500) + '...';
    console.log('\nPreview:');
    console.log(preview);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
