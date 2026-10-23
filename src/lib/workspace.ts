export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  status?: string;
  htmlLink?: string;
  isDemo?: boolean;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  subject: string;
  date: string;
  unread: boolean;
  isDemo?: boolean;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: string;
  isDemo?: boolean;
}

export interface GoogleTaskItem {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  updated?: string;
  isDemo?: boolean;
}

export interface ContactItem {
  id: string;
  name: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  isDemo?: boolean;
}

// 1. Google Calendar - Upcoming Events
export async function getCalendarEvents(accessToken: string | null): Promise<CalendarEvent[]> {
  if (!accessToken) {
    return [
      {
        id: 'demo-cal-1',
        summary: 'Alexa+ Hackathon Architecture Review',
        description: 'Review Nexus AI client boundary and MCP integration with team.',
        location: 'Virtual Room A / Google Meet',
        start: { dateTime: new Date(Date.now() + 3600000 * 2).toISOString() },
        end: { dateTime: new Date(Date.now() + 3600000 * 3).toISOString() },
        isDemo: true,
      },
      {
        id: 'demo-cal-2',
        summary: 'Smart Home Hub Sync & Lighting Test',
        description: 'Test Philips Hue and Matter bridge ambient routines.',
        location: 'Home Studio',
        start: { dateTime: new Date(Date.now() + 3600000 * 5).toISOString() },
        end: { dateTime: new Date(Date.now() + 3600000 * 5.5).toISOString() },
        isDemo: true,
      },
      {
        id: 'demo-cal-3',
        summary: 'Dinner with Elena & Family',
        description: 'Reservation at Bistro Verde',
        location: 'Downtown Bistro Verde',
        start: { dateTime: new Date(Date.now() + 3600000 * 10).toISOString() },
        end: { dateTime: new Date(Date.now() + 3600000 * 12).toISOString() },
        isDemo: true,
      },
    ];
  }

  try {
    const timeMin = new Date().toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=8&orderBy=startTime&singleEvents=true&timeMin=${encodeURIComponent(timeMin)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Calendar API returned ${res.status}`);
    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      id: item.id,
      summary: item.summary || '(Untitled Event)',
      description: item.description,
      location: item.location,
      start: item.start || {},
      end: item.end || {},
      status: item.status,
      htmlLink: item.htmlLink,
      isDemo: false,
    }));
  } catch (err) {
    console.warn('Falling back to demo calendar events:', err);
    return getCalendarEvents(null);
  }
}

// 2. Google Calendar - Tomorrow's Events (Genuine Workflow Step 1)
export async function getTomorrowCalendarEvents(accessToken: string): Promise<CalendarEvent[]> {
  const tomorrowStart = new Date();
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
    tomorrowStart.toISOString()
  )}&timeMax=${encodeURIComponent(tomorrowEnd.toISOString())}&singleEvents=true&orderBy=startTime`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Google Calendar API returned status ${res.status}`);
  }

  const data = await res.json();
  return (data.items || []).map((item: any) => ({
    id: item.id,
    summary: item.summary || '(Untitled Event)',
    description: item.description,
    location: item.location,
    start: item.start || {},
    end: item.end || {},
    status: item.status,
    htmlLink: item.htmlLink,
    isDemo: false,
  }));
}

// 3. Gmail - Find Relevant Emails for Tomorrow's Schedule (Genuine Workflow Step 2)
export async function findRelevantEmails(accessToken: string, queryKeyword: string): Promise<GmailMessageSummary[]> {
  const cleanQuery = queryKeyword.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const q = cleanQuery ? `${cleanQuery} newer_than:7d` : 'newer_than:2d';

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=3`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!listRes.ok) {
    throw new Error(`Gmail API returned status ${listRes.status}`);
  }

  const listData = await listRes.json();
  const messages = listData.messages || [];

  const results = await Promise.all(
    messages.map(async (m: { id: string }) => {
      try {
        const mRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!mRes.ok) return null;
        const msg = await mRes.json();
        const headers = msg.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        return {
          id: msg.id,
          threadId: msg.threadId,
          snippet: msg.snippet || '',
          from: getHeader('From'),
          subject: getHeader('Subject') || '(No Subject)',
          date: getHeader('Date'),
          unread: (msg.labelIds || []).includes('UNREAD'),
          isDemo: false,
        };
      } catch {
        return null;
      }
    })
  );

  return results.filter(Boolean) as GmailMessageSummary[];
}

export async function createCalendarEvent(
  accessToken: string,
  event: { summary: string; description?: string; startTime: string; endTime: string }
): Promise<any> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.startTime },
      end: { dateTime: event.endTime },
    }),
  });
  if (!res.ok) throw new Error(`Failed to create calendar event: ${res.status}`);
  return await res.json();
}

// 4. Gmail - Standard List
export async function getGmailMessages(accessToken: string | null): Promise<GmailMessageSummary[]> {
  if (!accessToken) {
    return [
      {
        id: 'demo-msg-1',
        threadId: 't1',
        snippet: 'Here is the preliminary Alexa+ Hackathon submission guidelines and deadlines...',
        from: 'Amazon Developer Portal <developer-updates@amazon.com>',
        subject: 'Alexa+ Hackathon: Final Prototype Checkpoint',
        date: 'Today, 9:42 AM',
        unread: true,
        isDemo: true,
      },
      {
        id: 'demo-msg-2',
        threadId: 't2',
        snippet: 'Your order for Nespresso Pods & Smart Plug has shipped via Amazon Prime...',
        from: 'Amazon Orders <auto-confirm@amazon.com>',
        subject: 'Shipped: Nespresso Vertuo Pods & Kasa Smart Plug',
        date: 'Yesterday, 4:15 PM',
        unread: false,
        isDemo: true,
      },
      {
        id: 'demo-msg-3',
        threadId: 't3',
        snippet: 'Flight confirmation for your upcoming trip to Seattle next Thursday...',
        from: 'Delta Airlines <reservations@delta.com>',
        subject: 'Flight Confirmation: SFO -> SEA #DL1842',
        date: 'Oct 18',
        unread: true,
        isDemo: true,
      },
    ];
  }

  try {
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=label:INBOX',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!listRes.ok) throw new Error(`Gmail list returned ${listRes.status}`);
    const listData = await listRes.json();
    const messages = listData.messages || [];

    const details = await Promise.all(
      messages.map(async (m: { id: string }) => {
        try {
          const mRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (!mRes.ok) return null;
          const msg = await mRes.json();
          const headers = msg.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

          return {
            id: msg.id,
            threadId: msg.threadId,
            snippet: msg.snippet || '',
            from: getHeader('From'),
            subject: getHeader('Subject') || '(No Subject)',
            date: getHeader('Date'),
            unread: (msg.labelIds || []).includes('UNREAD'),
            isDemo: false,
          };
        } catch {
          return null;
        }
      })
    );

    return details.filter(Boolean) as GmailMessageSummary[];
  } catch (err) {
    console.warn('Falling back to demo Gmail data:', err);
    return getGmailMessages(null);
  }
}

export async function sendGmailMessage(
  accessToken: string,
  to: string,
  subject: string,
  body: string
): Promise<any> {
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const messageParts = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    body,
  ];
  const message = messageParts.join('\r\n');
  const encodedMessage = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });
  if (!res.ok) throw new Error(`Failed to send email: ${res.status}`);
  return await res.json();
}

// 5. Google Drive
export async function getDriveFiles(accessToken: string | null): Promise<DriveFileItem[]> {
  if (!accessToken) {
    return [
      {
        id: 'demo-drive-1',
        name: 'Nexus AI - System Architecture Spec.pdf',
        mimeType: 'application/pdf',
        modifiedTime: '2 hours ago',
        webViewLink: '#',
        size: '1.4 MB',
        isDemo: true,
      },
      {
        id: 'demo-drive-2',
        name: 'Smart Home Automation Routines.gdoc',
        mimeType: 'application/vnd.google-apps.document',
        modifiedTime: 'Yesterday',
        webViewLink: '#',
        size: '24 KB',
        isDemo: true,
      },
      {
        id: 'demo-drive-3',
        name: 'Monthly Household & Grocery Budget.gsheet',
        mimeType: 'application/vnd.google-apps.spreadsheet',
        modifiedTime: '3 days ago',
        webViewLink: '#',
        size: '68 KB',
        isDemo: true,
      },
    ];
  }

  try {
    const url =
      'https://www.googleapis.com/drive/v3/files?pageSize=10&fields=files(id,name,mimeType,modifiedTime,webViewLink,size)&orderBy=modifiedTime desc';
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Drive API returned ${res.status}`);
    const data = await res.json();
    return (data.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime,
      webViewLink: f.webViewLink,
      size: f.size ? `${Math.round(f.size / 1024)} KB` : undefined,
      isDemo: false,
    }));
  } catch (err) {
    console.warn('Falling back to demo Drive files:', err);
    return getDriveFiles(null);
  }
}

// 6. Google Tasks
export async function getGoogleTasks(accessToken: string | null): Promise<GoogleTaskItem[]> {
  if (!accessToken) {
    return [
      {
        id: 'demo-task-1',
        title: 'Complete voice integration test on Echo Show',
        notes: 'Check low-latency audio response and interruption handling.',
        status: 'needsAction',
        due: 'Today',
        isDemo: true,
      },
      {
        id: 'demo-task-2',
        title: 'Review Amazon Developer Hackathon criteria',
        notes: 'Ensure voice-first experience and ambient OS aesthetics are highlighted.',
        status: 'needsAction',
        due: 'Tomorrow',
        isDemo: true,
      },
      {
        id: 'demo-task-3',
        title: 'Order replacement water filter cartridges',
        notes: 'Ready in commerce queue awaiting approval.',
        status: 'completed',
        due: 'Yesterday',
        isDemo: true,
      },
    ];
  }

  try {
    const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists/@default/tasks', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Tasks API returned ${res.status}`);
    const data = await res.json();
    return (data.items || []).map((t: any) => ({
      id: t.id,
      title: t.title || '(Untitled Task)',
      notes: t.notes,
      status: t.status,
      due: t.due,
      updated: t.updated,
      isDemo: false,
    }));
  } catch (err) {
    console.warn('Falling back to demo tasks:', err);
    return getGoogleTasks(null);
  }
}

export async function createGoogleTask(
  accessToken: string,
  title: string,
  notes?: string
): Promise<any> {
  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists/@default/tasks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, notes }),
  });
  if (!res.ok) throw new Error(`Failed to create Google task: ${res.status}`);
  return await res.json();
}

// 7. Contacts
export async function getContacts(accessToken: string | null): Promise<ContactItem[]> {
  if (!accessToken) {
    return [
      {
        id: 'demo-c1',
        name: 'Sarah Chen',
        email: 'sarah.chen@innovate.tech',
        phone: '+1 (555) 234-5678',
        isDemo: true,
      },
      {
        id: 'demo-c2',
        name: 'David Miller',
        email: 'david.m@cloudscale.io',
        phone: '+1 (555) 876-5432',
        isDemo: true,
      },
      {
        id: 'demo-c3',
        name: 'Elena Rostova',
        email: 'elena.rostova@designworks.com',
        phone: '+1 (555) 345-6789',
        isDemo: true,
      },
    ];
  }

  try {
    const url =
      'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,photos&pageSize=10';
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Contacts API returned ${res.status}`);
    const data = await res.json();
    return (data.connections || []).map((c: any) => ({
      id: c.resourceName,
      name: c.names?.[0]?.displayName || 'Unnamed Contact',
      email: c.emailAddresses?.[0]?.value || '',
      phone: c.phoneNumbers?.[0]?.value,
      photoUrl: c.photos?.[0]?.url,
      isDemo: false,
    }));
  } catch (err) {
    console.warn('Falling back to demo contacts:', err);
    return getContacts(null);
  }
}
