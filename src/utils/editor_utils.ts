/**
 * Finds a match where lines match after trimming whitespace.
 */
function trimMatch(original: string, search: string, startIdx: number): [number, number] | false {
  const originalLines = original.split("\n");
  const searchLines = search.split("\n");
  
  // Remove empty trailing line if it exists
  if (searchLines[searchLines.length - 1] === "") {
    searchLines.pop();
  }
  
  // Find the starting line number for our search
  let startLineNum = 0;
  let currentIndex = 0;
  while (currentIndex < startIdx && startLineNum < originalLines.length) {
    currentIndex += originalLines[startLineNum].length + 1; // +1 for \n
    startLineNum++;
  }
  
  // Try to find a match at each possible starting position
  for (let i = startLineNum; i <= originalLines.length - searchLines.length; i++) {
    let matches = true;
    
    // Check if all lines match (after trimming)
    for (let j = 0; j < searchLines.length; j++) {
      if (originalLines[i + j].trim() !== searchLines[j].trim()) {
        matches = false;
        break;
      }
    }
    
    // If found a match, calculate the character positions
    if (matches) {
      // Calculate start position
      let matchStartIndex = 0;
      for (let k = 0; k < i; k++) {
        matchStartIndex += originalLines[k].length + 1; // +1 for \n
      }
      
      // Calculate end position
      let matchEndIndex = matchStartIndex;
      for (let k = 0; k < searchLines.length; k++) {
        matchEndIndex += originalLines[i + k].length + 1; // +1 for \n
      }
      
      return [matchStartIndex, matchEndIndex];
    }
  }
  
  return false;
}

/**
 * Normalizes newlines by replacing escaped newline sequences (\\n) with actual newlines (\n).
 */
function normalizeNewlines(content: string): string {
  return content.replace(/\\n/g, "\n");
}

/**
 * Applies a diff in SEARCH/REPLACE format to the original content.
 * Handles both actual newlines (\n) and escaped newlines (\\n).
 */
export async function applyDiff(diff: string, original: string, isFinal: boolean): Promise<string> {
  // Normalize the original content to handle escaped newlines
  diff = normalizeNewlines(diff);
  original = normalizeNewlines(original);
  let result = "";
  let lastIdx = 0;
  
  let searchContent = "";
  let inSearch = false;
  let inReplace = false;
  
  let matchStartIdx = -1;
  let matchEndIdx = -1;
  
  const lines = diff.split("\n");
  
  // Handle each line in the diff content
  for (const line of lines) {
    if (line === "<<<<<<< SEARCH") {
      inSearch = true;
      searchContent = "";
      continue;
    }
    
    if (line === "=======") {
      inSearch = false;
      inReplace = true;
      
      // Handle search block
      if (!searchContent) {
        // Empty search block (new file or full replacement)
        matchStartIdx = 0;
        matchEndIdx = original.length === 0 ? 0 : original.length;
      } else {
        // Try exact match first
        const exactIndex = original.indexOf(searchContent, lastIdx);
        if (exactIndex !== -1) {
          matchStartIdx = exactIndex;
          matchEndIdx = exactIndex + searchContent.length;
        } else {
          // Try whitespace-insensitive match
          const match = trimMatch(original, searchContent, lastIdx);
          if (match) {
            [matchStartIdx, matchEndIdx] = match;
          } else {
            throw new Error(`Could not find a match for the SEARCH block in the file.`);
          }
        }
      }
      
      // Output everything up to the match location
      result += original.slice(lastIdx, matchStartIdx);
      continue;
    }
    
    if (line === ">>>>>>> REPLACE") {
      // Finished a replace block
      lastIdx = matchEndIdx;
      inSearch = false;
      inReplace = false;
      searchContent = "";
      matchStartIdx = -1;
      matchEndIdx = -1;
      continue;
    }
    
    // Accumulate content
    if (inSearch) {
      searchContent += line + "\n";
    } else if (inReplace) {
      // Output replacement lines immediately
      if (matchStartIdx !== -1) {
        result += line + "\n";
      }
    }
  }
  
  // If this is the final chunk, append any remaining original content
  if (isFinal && lastIdx < original.length) {
    result += original.slice(lastIdx);
  }
  
  return result;
}
