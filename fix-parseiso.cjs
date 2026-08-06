const fs = require('fs');

const files = [
  'src/routes/amenities.tsx',
  'src/routes/audit-log.tsx',
  'src/routes/events.tsx',
  'src/routes/forum.tsx',
  'src/routes/maintenance.tsx',
  'src/routes/notices.tsx',
  'src/routes/notifications.tsx',
  'src/routes/polls.tsx',
  'src/routes/utility-meters.tsx',
  'src/routes/visitor.tsx',
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  // Replace parseISO(...) with new Date(...) everywhere
  content = content.replace(/parseISO\(([^)]+)\)/g, 'new Date($1)');
  // Clean up unused parseISO imports
  content = content
    .replace('import { format, parseISO } from "date-fns";', 'import { format } from "date-fns";')
    .replace("import { format, parseISO } from 'date-fns';", "import { format } from 'date-fns';")
    .replace('import { formatDistanceToNow, parseISO } from "date-fns";', 'import { formatDistanceToNow } from "date-fns";')
    .replace("import { formatDistanceToNow, parseISO } from 'date-fns';", "import { formatDistanceToNow } from 'date-fns';")
    .replace('import { formatDistanceToNow, parseISO, isAfter } from "date-fns";', 'import { formatDistanceToNow, isAfter } from "date-fns";')
    .replace("import { formatDistanceToNow, parseISO, isAfter } from 'date-fns';", "import { formatDistanceToNow, isAfter } from 'date-fns';");
  fs.writeFileSync(file, content);
  console.log('Fixed:', file);
}
