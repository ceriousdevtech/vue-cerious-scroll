/**
 * Deterministic chat message data. Shared across React, Vue, and Angular demos.
 */
import { pick, randInt } from '../lib/random';

export const CHAT_BASE = 100_000;

export interface ChatUser {
  name: string;
  emoji: string;
  color: string;
}

export interface ChatMessage {
  id: number;
  user: ChatUser;
  text: string;
  time: string;
  reactions: Array<{ emoji: string; count: number }>;
  isSent: boolean;
}

const USERS: ChatUser[] = [
  { name: 'Alice Chen', emoji: '👩‍💻', color: '#667eea' },
  { name: 'Bob Smith', emoji: '🧑‍💼', color: '#d6336c' },
  { name: 'Carol Davis', emoji: '👩‍🔬', color: '#1c7ed6' },
  { name: 'David Kim', emoji: '🧑‍🎨', color: '#2f9e44' },
  { name: 'Emma Wilson', emoji: '👩‍🏫', color: '#e8590c' },
  { name: 'Frank Brown', emoji: '🧑‍🚀', color: '#0ca678' },
  { name: 'Grace Lee', emoji: '👩‍⚕️', color: '#7048e8' },
  { name: 'Henry Zhang', emoji: '🧑‍🔧', color: '#c2255c' },
];

const TEMPLATES = [
  'Hey team! Any update on {topic}?',
  'I just finished {task}. Ready for review!',
  'Can someone help me with {problem}?',
  'Great job on {achievement}! 🎉',
  'Quick question about {topic} — anyone available?',
  'Thanks for the feedback on {task}!',
  "I'll take care of {task} by EOD",
  'Meeting in 10 about {topic}',
  'Just pushed the latest changes for {task}',
  'Found a bug in {problem}, investigating now',
  'Coffee break? ☕',
  "Who's up for lunch?",
  '👍',
  'Agreed!',
  "Let's discuss in standup",
  'Updated the docs for {topic}',
  'This is looking great — keep it up!',
  "I'm blocked on {task}, need a hand",
  'Running tests now…',
  'All green! ✅',
  'Deployed to staging',
  'Code review complete — looks good!',
];

const TOPICS = ['the new feature', 'authentication', 'DB optimization', 'the UI redesign', 'API endpoints', 'deployment'];
const TASKS = ['the login flow', 'the dashboard', 'payment integration', 'email notifications', 'search', 'the admin panel'];
const PROBLEMS = ['the caching layer', 'rate limiting', 'memory usage', 'slow queries', 'build errors'];
const ACHIEVEMENTS = ['hitting our KPIs', 'the launch', 'fixing the critical bug', 'the perf win'];
const REACTIONS = ['❤️', '👍', '😂', '🎉', '🚀'];

export function generateMessage(index: number): ChatMessage {
  const user = USERS[index % USERS.length];
  let text = TEMPLATES[index % TEMPLATES.length]
    .replace('{topic}', pick(TOPICS, index, 1))
    .replace('{task}', pick(TASKS, index, 2))
    .replace('{problem}', pick(PROBLEMS, index, 3))
    .replace('{achievement}', pick(ACHIEVEMENTS, index, 4));

  const variant = index % 5;
  if (variant === 3)
    text +=
      " I've been on this a while and we're making good progress. Shout if you have questions or concerns!";
  else if (variant === 4)
    text += " Quick update: everything's on track and early feedback is positive. Done by end of week.";

  const reactions =
    index % 7 === 0
      ? [{ emoji: REACTIONS[index % REACTIONS.length], count: randInt(index, 1, 5, 9) }]
      : [];

  const ts = new Date(Date.UTC(2026, 0, 1) - (CHAT_BASE - index) * 60_000);
  const time = `${String(ts.getUTCHours()).padStart(2, '0')}:${String(ts.getUTCMinutes()).padStart(2, '0')}`;

  return { id: index, user, text, time, reactions, isSent: false };
}

export const ME: ChatUser = { name: 'You', emoji: '😊', color: '#00b09b' };

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
