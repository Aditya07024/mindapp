const fs = require('fs');
const content = fs.readFileSync('frontend/src/routes/therapist/dashboard.tsx', 'utf8');

function checkTags(text) {
    const stack = [];
    const regex = /<(\/?[a-zA-Z0-9.]+)(?:\s+[^>]*?)?(\/?)>/g;
    let match;
    let line = 1;
    let lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
        const fullTag = match[0];
        const tagName = match[1];
        const isSelfClosing = match[2] === '/' || ['br', 'hr', 'img', 'input', 'link', 'meta'].includes(tagName.toLowerCase());
        const isClosing = tagName.startsWith('/');

        // Update line count
        const skipped = text.substring(lastIndex, match.index);
        line += (skipped.match(/\n/g) || []).length;
        lastIndex = match.index;

        if (isSelfClosing) continue;

        if (isClosing) {
            const actualName = tagName.substring(1);
            if (stack.length === 0) {
                console.log(`Error: Closing tag </${actualName}> at line ${line} has no opening tag`);
            } else {
                const openTag = stack.pop();
                if (openTag.name !== actualName) {
                    console.log(`Error: Mismatched tag </${actualName}> at line ${line}, expected </${openTag.name}> (opened at line ${openTag.line})`);
                }
            }
        } else {
            stack.push({ name: tagName, line: line });
        }
    }

    while (stack.length > 0) {
        const tag = stack.pop();
        console.log(`Error: Unclosed tag <${tag.name}> opened at line ${tag.line}`);
    }
}

checkTags(content);
