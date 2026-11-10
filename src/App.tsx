/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';

export type UndoableAction =
  | {
      type: 'task_creation';
      task: TaskItem;
      timestamp: number;
    }
  | {
      type: 'workflow_step_execution';
      workflowId: string;
      stepId: string;
      stepTitle: string;
      previousStepStatus: WorkflowStep['status'];
      previousWorkflowStatus: WorkflowExecution['status'];
      previousCurrentStepIndex: number;
      timestamp: number;
    };
import { testFirestoreConnection } from './lib/firebase';
import { initAuth, googleSignIn, logout } from './lib/auth';
import {
  syncUserProfile,
  getUserProfile,
  saveUserProfile,
  getUserPreferences,
  saveUserPreferences,
  fetchUserTasks,
  saveTaskToFirestore,
  deleteTaskFromFirestore,
  fetchUserMessages,
  saveMessageToFirestore,
  deleteMessageFromFirestore,
  clearUserMessages,
  fetchUserMemories,
  saveMemoryToFirestore,
  deleteMemoryFromFirestore,
  fetchUserOrders,
  saveOrderToFirestore,
} from './lib/firestoreService';
import {
  getCalendarEvents,
  getGmailMessages,
  getGoogleTasks,
  type CalendarEvent,
  type GmailMessageSummary,
  type GoogleTaskItem,
} from './lib/workspace';
import { askGemini } from './lib/gemini';
import { audioEngine } from './lib/audio';
import { mcpClient } from './lib/mcpClient';
import { useTheme } from './lib/theme';
import type {
  ConversationMessage,
  TaskItem,
  Priority,
  WorkflowExecution,
  WorkflowStep,
  MemoryItem,
  CommerceOrder,
  OrderItem,
  UserPreference,
  UserProfile,
} from './types';

// Components
import { AmbientHeader } from './components/AmbientHeader';
import { Navigation } from './components/Navigation';
import { ConfirmationModal } from './components/ConfirmationModal';
import { OnboardingModal } from './components/OnboardingModal';
import { AudioWaveformVisualizer } from './components/AudioWaveformVisualizer';
import { Mic, Volume2, Square, X, Radio } from 'lucide-react';

// Views
import { HomeView } from './components/views/HomeView';
import { ConversationsView } from './components/views/ConversationsView';
import { WorkflowsView } from './components/views/WorkflowsView';
import { TasksView } from './components/views/TasksView';
import { CommerceView } from './components/views/CommerceView';
import { MemoryView } from './components/views/MemoryView';
import { IntegrationsView } from './components/views/IntegrationsView';
import { SettingsView } from './components/views/SettingsView';

export default function App() {
  // 0. Theme State (Dark / Light / System)
  const { theme, isDark, setTheme, toggleTheme } = useTheme();

  // 1. Auth & User State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [hasGoogleToken, setHasGoogleToken] = useState(false);

  // 2. Navigation State
  const [activeView, setActiveView] = useState<string>('home');

  // 3. Audio & Assistant State
  const [audioStatus, setAudioStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking' | 'error'>('idle');
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [assistantReply, setAssistantReply] = useState('');

  // 4. MCP Status & Diagnostics
  const [mcpStatus, setMcpStatus] = useState<'live_nexus_core' | 'auth_required' | 'demo_adapter'>('demo_adapter');
  const [mcpDetails, setMcpDetails] = useState<{
    message?: string;
    missingComponents?: string[];
    toolsCount?: number;
  }>({});

  // 5. User Profile & Preferences
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreference>({
    userId: 'guest',
    voiceName: 'Zephyr',
    voiceAccent: 'neutral-american',
    voiceSpeed: 1.0,
    voicePitch: 1.0,
    ambientTheme: 'cyber-dark',
    autoSpeak: true,
    wakeWordEnabled: true,
    noiseSuppression: true,
    continuousListening: false,
    soundEffects: true,
    reminderNoticeMinutes: 10,
    mcpBackendUrl: 'https://nexus-core-v4j3.onrender.com',
  });

  // 5b. Onboarding State
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nexus_onboarding_completed') !== 'true';
    } catch {
      return false;
    }
  });

  const handleCompleteOnboarding = () => {
    setShowOnboarding(false);
    try {
      localStorage.setItem('nexus_onboarding_completed', 'true');
    } catch {}
    const updated: UserPreference = {
      ...preferences,
      hasCompletedOnboarding: true,
    };
    setPreferences(updated);
    if (user) {
      saveUserPreferences(updated).catch(console.warn);
    }
    audioEngine.speak(
      'Welcome to Nexus AI. Your ambient operating system is initialized and standing by.',
      preferences.voiceName,
      true
    );
  };

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    try {
      localStorage.setItem('nexus_onboarding_completed', 'true');
    } catch {}
  };

  const handleOpenOnboarding = () => {
    setShowOnboarding(true);
  };

  // 6. Workspace Data
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [googleTasks, setGoogleTasks] = useState<GoogleTaskItem[]>([]);

  // 7. Core Application Domain Collections
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([
    {
      id: 'msg-seed-1',
      conversationId: 'c-main',
      role: 'assistant',
      content:
        "Hello! I'm Nexus AI, your ambient operating system for the Alexa+ hackathon. I'm connected to your schedule, communication, tasks, smart home scenes, and commerce. How can I assist your workflow today?",
      createdAt: 'Today, 09:00 AM',
    },
    {
      id: 'msg-seed-2',
      conversationId: 'c-main',
      role: 'user',
      content: 'What events do I have on my calendar tomorrow?',
      createdAt: 'Today, 09:15 AM',
    },
    {
      id: 'msg-seed-3',
      conversationId: 'c-main',
      role: 'assistant',
      content:
        'You have 2 scheduled events tomorrow: "Team Standup & Sprint Sync" at 10:00 AM, and "Alexa+ Hackathon Architecture Review" with the core engineering group at 2:30 PM.',
      createdAt: 'Today, 09:15 AM',
      toolCalls: [
        {
          name: 'google_calendar_list_events',
          args: { timeMin: '2026-11-11T00:00:00Z', timeMax: '2026-11-11T23:59:59Z' },
          result: { count: 2, status: 'synced' },
          status: 'success',
        },
      ],
    },
    {
      id: 'msg-seed-4',
      conversationId: 'c-main',
      role: 'user',
      content: 'Check for any urgent unread emails from our hackathon mentors.',
      createdAt: 'Yesterday, 04:30 PM',
    },
    {
      id: 'msg-seed-5',
      conversationId: 'c-main',
      role: 'assistant',
      content:
        'Found 1 critical email from AWS Alexa+ Developer Relations with the subject "Hackathon Verification Guidelines & Ephemeral Session Tokens".',
      createdAt: 'Yesterday, 04:31 PM',
      toolCalls: [
        {
          name: 'gmail_search_threads',
          args: { q: 'is:unread hackathon mentor' },
          result: { found: 1, messageId: 'msg-alexa-guide' },
          status: 'success',
        },
      ],
    },
    {
      id: 'msg-seed-6',
      conversationId: 'c-main',
      role: 'user',
      content: 'Order organic almond milk and fresh coffee beans for the morning briefing.',
      createdAt: '3 days ago',
    },
    {
      id: 'msg-seed-7',
      conversationId: 'c-main',
      role: 'assistant',
      content:
        'I have drafted a commerce order for Organic Almond Milk ($4.49) and Artisanal Espresso Beans ($16.99). Total is $21.48. Waiting for your confirmation before final checkout.',
      createdAt: '3 days ago',
      toolCalls: [
        {
          name: 'commerce_draft_order',
          args: { items: ['Almond Milk', 'Espresso Beans'], total: 21.48 },
          result: { orderId: 'ord-8831', status: 'pending_approval' },
          status: 'approval_required',
        },
      ],
    },
    {
      id: 'msg-seed-8',
      conversationId: 'c-main',
      role: 'user',
      content: 'Create a task to audit all MCP tool endpoints before deployment.',
      createdAt: '5 days ago',
    },
    {
      id: 'msg-seed-9',
      conversationId: 'c-main',
      role: 'assistant',
      content:
        'Created task "Audit all MCP tool endpoints before deployment" with high priority under the workspace category.',
      createdAt: '5 days ago',
      toolCalls: [
        {
          name: 'task_create',
          args: { title: 'Audit all MCP tool endpoints before deployment', priority: 'high' },
          result: { taskId: 't-seed-audit', status: 'created' },
          status: 'success',
        },
      ],
    },
  ]);

  const [tasks, setTasks] = useState<TaskItem[]>([
    {
      id: 't-1',
      userId: 'user',
      title: 'Review Amazon Alexa+ Hackathon Submission Checklist',
      description: 'Verify ambient display widgets, voice orb interactivity, and MCP boundary.',
      priority: 'urgent',
      status: 'pending',
      category: 'workspace',
      dueDate: 'Today, 5:00 PM',
      createdAt: 'Today',
    },
    {
      id: 't-2',
      userId: 'user',
      title: 'Test Google Calendar & Gmail OAuth Token In-Memory Storage',
      description: 'Ensure least privilege scopes and confirmation gates are respected.',
      priority: 'high',
      status: 'pending',
      category: 'workspace',
      dueDate: 'Today',
      createdAt: 'Today',
    },
    {
      id: 't-3',
      userId: 'user',
      title: 'Verify Gemini 3.8 Flash Lite TTS audio output',
      description: 'Test Zephyr voice playback and speech interruption.',
      priority: 'medium',
      status: 'completed',
      category: 'personal',
      dueDate: 'Yesterday',
      createdAt: 'Yesterday',
    },
  ]);

  const [workflows, setWorkflows] = useState<WorkflowExecution[]>([
    {
      id: 'wf-morning',
      userId: 'user',
      title: 'Executive Morning Briefing & Environmental Scene',
      triggerType: 'voice_command',
      status: 'idle',
      currentStepIndex: 0,
      createdAt: 'Today, 8:00 AM',
      updatedAt: 'Just now',
      steps: [
        {
          id: 's-1',
          title: 'Query Google Calendar Agenda',
          description: 'Fetch next 8 hours of scheduled meetings and conflicts.',
          service: 'google_calendar',
          status: 'completed',
          durationMs: 142,
          output: { eventsFound: 3, nextMeeting: 'Team Architecture Sync at 2:00 PM' },
        },
        {
          id: 's-2',
          title: 'Filter Gmail Priority Updates',
          description: 'Scan inbox for high-importance messages.',
          service: 'gmail',
          status: 'completed',
          durationMs: 215,
          output: { unreadPriority: 2, topSender: 'Amazon Developer Portal' },
        },
        {
          id: 's-3',
          title: 'Activate Smart Home Ambient Lighting',
          description: 'Set living studio lights to Focus Glow (5500K, 80% brightness).',
          service: 'smart_home',
          status: 'completed',
          durationMs: 88,
          output: { sceneApplied: 'Focus Glow', bridge: 'Matter' },
        },
        {
          id: 's-4',
          title: 'Draft Schedule Summary Notification',
          description: 'Prepare audio briefing and sync with Google Tasks.',
          service: 'google_tasks',
          status: 'pending',
        },
      ],
    },
    {
      id: 'wf-commerce',
      userId: 'user',
      title: 'Pantry Low Stock Replenishment',
      triggerType: 'scheduled',
      status: 'pending_approval',
      currentStepIndex: 2,
      createdAt: 'Today, 9:15 AM',
      updatedAt: '10 mins ago',
      steps: [
        {
          id: 'c-1',
          title: 'Check Inventory Sensor Telemetry',
          description: 'Smart pantry weight sensor detected coffee pods < 5.',
          service: 'smart_home',
          status: 'completed',
          durationMs: 95,
        },
        {
          id: 'c-2',
          title: 'Stage Amazon Alexa+ Commerce Order',
          description: 'Selected Nespresso Vertuo Intenso (30ct) - $36.50.',
          service: 'commerce',
          status: 'completed',
          durationMs: 160,
          output: { item: 'Nespresso Vertuo Intenso', total: 36.5 },
        },
        {
          id: 'c-3',
          title: 'Human-in-the-Loop Purchase Authorization',
          description: 'Awaiting explicit user voice or tap confirmation before billing.',
          service: 'mcp_core',
          status: 'approval_required',
        },
      ],
    },
  ]);

  const [activeCart, setActiveCart] = useState<OrderItem[]>([
    {
      id: 'cart-1',
      name: 'Nespresso Vertuo Intenso Coffee Pods (30ct)',
      price: 36.5,
      quantity: 1,
      category: 'Pantry',
    },
  ]);

  const [orders, setOrders] = useState<CommerceOrder[]>([
    {
      id: 'ord-101',
      userId: 'user',
      title: 'Philips Hue Smart Ambient Lightbulb (White & Color)',
      items: [
        {
          id: 'p-1',
          name: 'Philips Hue Smart Ambient Lightbulb',
          price: 49.99,
          quantity: 1,
          category: 'Smart Home',
        },
      ],
      totalAmount: 49.99,
      currency: 'USD',
      status: 'fulfilled',
      approvalRequired: true,
      createdAt: 'Yesterday, 3:20 PM',
    },
  ]);

  const [memories, setMemories] = useState<MemoryItem[]>([
    {
      id: 'mem-1',
      userId: 'user',
      category: 'preference',
      key: 'Coffee Routine',
      value: 'Drinks double espresso with splash of oat milk before 10 AM.',
      confidence: 0.98,
      createdAt: 'Oct 14',
    },
    {
      id: 'mem-2',
      userId: 'user',
      category: 'schedule',
      key: 'Focus Time Window',
      value: 'Prefers no meetings scheduled on Tuesday afternoons between 1 PM and 4 PM.',
      confidence: 0.94,
      createdAt: 'Oct 16',
    },
    {
      id: 'mem-3',
      userId: 'user',
      category: 'home',
      key: 'Lighting Temperature',
      value: 'Prefers warm 2700K ambient glow in the evening after 8 PM.',
      confidence: 0.96,
      createdAt: 'Oct 18',
    },
  ]);

  // 7b. Action History for 'Undo Last Action'
  const [actionHistory, setActionHistory] = useState<UndoableAction[]>([]);
  const actionHistoryRef = useRef<UndoableAction[]>([]);
  actionHistoryRef.current = actionHistory;

  const workflowsRef = useRef<WorkflowExecution[]>([]);
  workflowsRef.current = workflows;

  const tasksRef = useRef<TaskItem[]>([]);
  tasksRef.current = tasks;

  // 8. Confirmation Modal State (MANDATORY for human-in-the-loop safety)
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel?: string;
    isDestructive?: boolean;
    itemDetails?: Record<string, any>;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
  });

  // Initialize Auth, Firestore & Workspace
  useEffect(() => {
    testFirestoreConnection();

    // Check production MCP Core status
    mcpClient.checkStatus().then((res) => {
      if (res.state === 'connected') {
        setMcpStatus('live_nexus_core');
      } else if (res.state === 'auth_required') {
        setMcpStatus('auth_required');
      } else {
        setMcpStatus('demo_adapter');
      }
      setMcpDetails({
        message: res.message,
        missingComponents: res.missingComponents,
        toolsCount: res.toolsCount,
      });
    });

    const unsubscribe = initAuth(
      async (firebaseUser, token) => {
        setUser(firebaseUser);
        setAccessToken(token);
        setHasGoogleToken(Boolean(token));

        // Sync User Profile to Firestore
        syncUserProfile({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        }).catch((e) => console.warn('Firestore user profile sync:', e));

        // Load data from Google Workspace with token (or demo data)
        const [calData, mailData, tasksData] = await Promise.all([
          getCalendarEvents(token),
          getGmailMessages(token),
          getGoogleTasks(token),
        ]);

        setEvents(calData);
        setMessages(mailData);
        setGoogleTasks(tasksData);

        // Fetch User Profile, Preferences & Collections from Firestore
        try {
          const [dbProfile, userPrefs] = await Promise.all([
            getUserProfile(firebaseUser.uid).catch(() => null),
            getUserPreferences(firebaseUser.uid).catch(() => null),
          ]);

          if (dbProfile) {
            setUserProfile(dbProfile);
          } else {
            const initialProfile: UserProfile = {
              userId: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'Google User',
              photoURL: firebaseUser.photoURL || '',
              bio: 'Ambient AI workspace user',
              location: 'San Francisco, CA',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles',
              createdAt: new Date().toISOString(),
            };
            setUserProfile(initialProfile);
          }

          if (userPrefs) {
            setPreferences((prev) => ({ ...prev, ...userPrefs }));
            if (userPrefs.hasCompletedOnboarding) {
              setShowOnboarding(false);
            }
          } else {
            const initialPref: UserPreference = {
              userId: firebaseUser.uid,
              voiceName: 'Zephyr',
              voiceAccent: 'neutral-american',
              voiceSpeed: 1.0,
              voicePitch: 1.0,
              ambientTheme: 'cyber-dark',
              autoSpeak: true,
              wakeWordEnabled: true,
              noiseSuppression: true,
              continuousListening: false,
              soundEffects: true,
              reminderNoticeMinutes: 10,
              mcpBackendUrl: 'https://nexus-core-v4j3.onrender.com',
            };
            setPreferences(initialPref);
            saveUserPreferences(initialPref).catch(console.warn);
          }

          // Load tasks, memories, messages from Firestore if available
          const [dbTasks, dbMemories, dbMessages, dbOrders] = await Promise.all([
            fetchUserTasks(firebaseUser.uid).catch(() => []),
            fetchUserMemories(firebaseUser.uid).catch(() => []),
            fetchUserMessages(firebaseUser.uid).catch(() => []),
            fetchUserOrders(firebaseUser.uid).catch(() => []),
          ]);

          if (dbTasks && dbTasks.length > 0) setTasks(dbTasks);
          if (dbMemories && dbMemories.length > 0) setMemories(dbMemories);
          if (dbMessages && dbMessages.length > 0) setConversationMessages(dbMessages);
          if (dbOrders && dbOrders.length > 0) setOrders(dbOrders);
        } catch (e) {
          console.warn('Firestore initial data load:', e);
        }
      },
      async () => {
        setUser(null);
        setAccessToken(null);
        setHasGoogleToken(false);
        // Load demo data
        const [calData, mailData, tasksData] = await Promise.all([
          getCalendarEvents(null),
          getGmailMessages(null),
          getGoogleTasks(null),
        ]);
        setEvents(calData);
        setMessages(mailData);
        setGoogleTasks(tasksData);
      }
    );

    return () => unsubscribe();
  }, []);

  // Voice Audio Engine Callbacks
  useEffect(() => {
    audioEngine.setCallbacks(
      (text, isFinal) => {
        setTranscript(text);
        if (isFinal && text.trim()) {
          handleVoiceCommand(text.trim());
        }
      },
      (status) => {
        setAudioStatus(status);
        setIsListening(status === 'listening');
      }
    );
  }, [preferences.voiceName, preferences.autoSpeak, events, messages, tasks, workflows, actionHistory]);

  // Voice Command Orchestrator
  const handleVoiceCommand = async (command: string) => {
    setAudioStatus('thinking');
    setTranscript(command);

    const userMsg: ConversationMessage = {
      id: `usr-${Date.now()}`,
      conversationId: 'active-session',
      role: 'user',
      content: command,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setConversationMessages((prev) => [...prev, userMsg]);
    if (user) {
      saveMessageToFirestore(userMsg, user.uid).catch(console.warn);
    }

    const lower = command.toLowerCase().trim();

    // -------------------------------------------------------------
    // 'Undo Last Action' Command Handler
    // Reverts most recent task creation or workflow step execution
    // -------------------------------------------------------------
    const isUndoCommand =
      lower === 'undo' ||
      lower === 'undo last action' ||
      lower === 'undo that' ||
      lower === 'undo action' ||
      lower === 'revert' ||
      lower === 'revert last action' ||
      lower === 'revert that' ||
      lower.includes('undo last action') ||
      lower.includes('undo that action') ||
      lower.includes('undo previous action') ||
      lower.includes('undo last task') ||
      lower.includes('undo the last action') ||
      lower.includes('revert the last action') ||
      lower.includes('revert last action') ||
      lower === 'undo last step' ||
      lower === 'undo workflow step' ||
      lower.startsWith('undo');

    if (isUndoCommand) {
      const historyStack = actionHistoryRef.current;
      if (historyStack.length === 0) {
        const reply = 'There is no recent task creation or workflow step execution to undo.';
        setAssistantReply(reply);

        const botMsg: ConversationMessage = {
          id: `bot-${Date.now()}`,
          conversationId: 'active-session',
          role: 'assistant',
          content: reply,
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          toolCalls: [
            {
              name: 'action_undo',
              args: { command },
              result: { status: 'noop', reason: 'No undoable action in history' },
              status: 'success',
            },
          ],
        };

        setConversationMessages((prev) => [...prev, botMsg]);
        if (user) {
          saveMessageToFirestore(botMsg, user.uid).catch(console.warn);
        }

        await audioEngine.speak(reply, preferences.voiceName, preferences.autoSpeak);
        setAudioStatus('idle');
        return;
      }

      // Pop the most recent action from history
      const lastAction = historyStack[historyStack.length - 1];
      setActionHistory((prev) => prev.slice(0, -1));

      if (lastAction.type === 'task_creation') {
        const { task } = lastAction;
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        if (user) {
          deleteTaskFromFirestore(task.id).catch(console.warn);
        }

        const reply = `Undone: Reverted creation of task "${task.title}". The task has been removed from your list.`;
        setAssistantReply(reply);

        const botMsg: ConversationMessage = {
          id: `bot-${Date.now()}`,
          conversationId: 'active-session',
          role: 'assistant',
          content: reply,
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          toolCalls: [
            {
              name: 'workspace_tasks_undo',
              args: { taskId: task.id, title: task.title },
              result: { status: 'reverted', taskId: task.id },
              status: 'success',
            },
          ],
        };

        setConversationMessages((prev) => [...prev, botMsg]);
        if (user) {
          saveMessageToFirestore(botMsg, user.uid).catch(console.warn);
        }

        await audioEngine.speak(reply, preferences.voiceName, preferences.autoSpeak);
        setAudioStatus('idle');
        return;
      }

      if (lastAction.type === 'workflow_step_execution') {
        const { workflowId, stepId, stepTitle, previousStepStatus, previousWorkflowStatus, previousCurrentStepIndex } =
          lastAction;

        setWorkflows((prev) =>
          prev.map((wf) => {
            if (wf.id !== workflowId) return wf;
            return {
              ...wf,
              status: previousWorkflowStatus,
              currentStepIndex: previousCurrentStepIndex,
              steps: wf.steps.map((s) => {
                if (s.id !== stepId) return s;
                return {
                  ...s,
                  status: previousStepStatus,
                };
              }),
            };
          })
        );

        const statusLabel =
          previousStepStatus === 'approval_required'
            ? 'pending approval'
            : previousStepStatus === 'pending'
            ? 'pending'
            : previousStepStatus;
        const reply = `Undone: Reverted workflow step "${stepTitle}" back to ${statusLabel}.`;
        setAssistantReply(reply);

        const botMsg: ConversationMessage = {
          id: `bot-${Date.now()}`,
          conversationId: 'active-session',
          role: 'assistant',
          content: reply,
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          toolCalls: [
            {
              name: 'workflow_step_undo',
              args: { workflowId, stepId, stepTitle, targetStatus: previousStepStatus },
              result: { status: 'reverted', restoredStepStatus: previousStepStatus },
              status: 'success',
            },
          ],
        };

        setConversationMessages((prev) => [...prev, botMsg]);
        if (user) {
          saveMessageToFirestore(botMsg, user.uid).catch(console.warn);
        }

        await audioEngine.speak(reply, preferences.voiceName, preferences.autoSpeak);
        setAudioStatus('idle');
        return;
      }
    }

    try {
      const history = conversationMessages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const userContext = {
        userName: user?.displayName || 'User',
        connectedIntegrations: ['Google Calendar', 'Gmail', 'Google Tasks', 'Smart Home', 'Commerce'],
        activeTaskCount: tasks.filter((t) => t.status === 'pending').length,
        upcomingEvent: events[0]?.summary || 'None',
      };

      // Call server-side Gemini 3.8 Flash endpoint
      const response = await askGemini(command, history, userContext);
      const reply = response.reply;

      setAssistantReply(reply);

      // Tool Invocation Detection
      const detectedToolCalls: ConversationMessage['toolCalls'] = [];

      if (lower.includes('schedule') || lower.includes('calendar') || lower.includes('meeting')) {
        detectedToolCalls.push({
          name: 'workspace_calendar_get_events',
          args: { query: command },
          result: { events: events.slice(0, 2) },
          status: 'success',
        });
      } else if (lower.includes('email') || lower.includes('gmail') || lower.includes('inbox')) {
        detectedToolCalls.push({
          name: 'workspace_gmail_query',
          args: { query: 'is:unread' },
          result: { messages: messages.slice(0, 2) },
          status: 'success',
        });
      } else if (lower.includes('task') || lower.includes('remind')) {
        let taskTitle = command
          .replace(/^(please\s+)?(create\s+a?\s*task|add\s+a?\s*task|new\s+task|remind\s+me\s+to|add\s+task)\s+/i, '')
          .trim();
        if (!taskTitle) taskTitle = command;
        taskTitle = taskTitle.charAt(0).toUpperCase() + taskTitle.slice(1);

        const newTask: TaskItem = {
          id: `t-${Date.now()}`,
          userId: user?.uid || 'user',
          title: taskTitle,
          description: `Created via ambient voice command: "${command}"`,
          priority: 'high',
          status: 'pending',
          category: 'workspace',
          dueDate: 'Today',
          createdAt: 'Just now',
        };
        setTasks((prev) => [newTask, ...prev]);
        if (user) {
          saveTaskToFirestore(newTask).catch(console.warn);
        }
        setActionHistory((prev) => [
          ...prev,
          {
            type: 'task_creation',
            task: newTask,
            timestamp: Date.now(),
          },
        ]);

        detectedToolCalls.push({
          name: 'workspace_tasks_manage',
          args: { task: taskTitle, action: 'create' },
          result: { status: 'created', taskId: newTask.id, title: taskTitle },
          status: 'success',
        });
      }

      // Voice approval for pending workflow steps
      if (lower.includes('approve') && (lower.includes('step') || lower.includes('workflow') || lower.includes('purchase'))) {
        const wfPending = workflowsRef.current.find(
          (w) => w.status === 'pending_approval' || w.steps.some((s) => s.status === 'approval_required')
        );
        if (wfPending) {
          const stepPending = wfPending.steps.find((s) => s.status === 'approval_required');
          if (stepPending) {
            setActionHistory((prev) => [
              ...prev,
              {
                type: 'workflow_step_execution',
                workflowId: wfPending.id,
                stepId: stepPending.id,
                stepTitle: stepPending.title,
                previousStepStatus: stepPending.status,
                previousWorkflowStatus: wfPending.status,
                previousCurrentStepIndex: wfPending.currentStepIndex,
                timestamp: Date.now(),
              },
            ]);
            setWorkflows((prev) =>
              prev.map((w) =>
                w.id === wfPending.id
                  ? {
                      ...w,
                      status: 'completed',
                      steps: w.steps.map((s) => (s.id === stepPending.id ? { ...s, status: 'completed' } : s)),
                    }
                  : w
              )
            );
            detectedToolCalls.push({
              name: 'workflow_step_approve',
              args: { workflowId: wfPending.id, stepId: stepPending.id },
              result: { status: 'executed', stepTitle: stepPending.title },
              status: 'success',
            });
          }
        }
      }

      const botMsg: ConversationMessage = {
        id: `bot-${Date.now()}`,
        conversationId: 'active-session',
        role: 'assistant',
        content: reply,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolCalls: detectedToolCalls,
      };

      setConversationMessages((prev) => [...prev, botMsg]);
      if (user) {
        saveMessageToFirestore(botMsg, user.uid).catch(console.warn);
      }

      // Speak assistant response using Gemini 3.8 Flash Lite TTS
      await audioEngine.speak(reply, preferences.voiceName, preferences.autoSpeak, {
        speed: preferences.voiceSpeed,
        pitch: preferences.voicePitch,
        accent: preferences.voiceAccent,
      });
    } catch (err: any) {
      console.error('Command processing error:', err);
      setAssistantReply('Sorry, I encountered an issue processing that request. Please try again.');
      setAudioStatus('idle');
    }
  };

  // Google Sign In handler
  const handleLogin = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
        setHasGoogleToken(true);

        const [calData, mailData, tasksData] = await Promise.all([
          getCalendarEvents(res.accessToken),
          getGmailMessages(res.accessToken),
          getGoogleTasks(res.accessToken),
        ]);
        setEvents(calData);
        setMessages(mailData);
        setGoogleTasks(tasksData);
      }
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setUserProfile(null);
    setAccessToken(null);
    setHasGoogleToken(false);
  };

  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    const uid = user ? user.uid : 'guest';
    const updatedProfile: UserProfile = {
      userId: uid,
      email: updates.email || userProfile?.email || user?.email || '',
      displayName: updates.displayName || userProfile?.displayName || user?.displayName || 'User',
      photoURL: updates.photoURL || userProfile?.photoURL || user?.photoURL || '',
      bio: updates.bio !== undefined ? updates.bio : userProfile?.bio || '',
      location: updates.location !== undefined ? updates.location : userProfile?.location || '',
      timezone: updates.timezone !== undefined ? updates.timezone : userProfile?.timezone || '',
      phoneNumber: updates.phoneNumber !== undefined ? updates.phoneNumber : userProfile?.phoneNumber || '',
      createdAt: userProfile?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setUserProfile(updatedProfile);
    if (user) {
      await saveUserProfile(updatedProfile).catch(console.warn);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      audioEngine.stopListening();
    } else {
      audioEngine.startListening();
    }
  };

  const toggleMute = () => {
    const muted = audioEngine.toggleMute();
    setIsMuted(muted);
  };

  const handleInterrupt = () => {
    audioEngine.interrupt();
    setAudioStatus('idle');
  };

  // Human-in-the-Loop Safe Actions with Confirmation Modal
  const handleApproveStep = (stepId: string) => {
    const targetWf = workflowsRef.current.find((w) => w.steps.some((s) => s.id === stepId));
    const targetStep = targetWf?.steps.find((s) => s.id === stepId);

    setModalState({
      isOpen: true,
      title: 'Authorize External Action Execution',
      description:
        'Nexus AI requires your explicit human-in-the-loop permission to execute this workflow step. No external action will be submitted without your consent.',
      actionLabel: 'Approve & Execute',
      isDestructive: false,
      itemDetails: { stepId, authorizationTime: new Date().toISOString() },
      onConfirm: () => {
        if (targetWf && targetStep) {
          setActionHistory((prev) => [
            ...prev,
            {
              type: 'workflow_step_execution',
              workflowId: targetWf.id,
              stepId: targetStep.id,
              stepTitle: targetStep.title,
              previousStepStatus: targetStep.status,
              previousWorkflowStatus: targetWf.status,
              previousCurrentStepIndex: targetWf.currentStepIndex,
              timestamp: Date.now(),
            },
          ]);
        }
        setWorkflows((prev) =>
          prev.map((wf) => ({
            ...wf,
            steps: wf.steps.map((s) => (s.id === stepId ? { ...s, status: 'completed' } : s)),
            status: 'completed',
          }))
        );
        setModalState((s) => ({ ...s, isOpen: false }));
        audioEngine.speak('Step successfully authorized and executed.', preferences.voiceName, true);
      },
    });
  };

  // Priority 3: Genuine Workspace Action Task Confirmation Gate
  const handleRequestTaskConfirmation = (
    title: string,
    notes: string,
    onConfirm: () => Promise<void>
  ) => {
    setModalState({
      isOpen: true,
      title: 'Authorize Google Tasks Creation',
      description:
        'Nexus AI analyzed tomorrow’s Google Calendar events and relevant Gmail messages, and drafted this action task. Confirm to create it in your Google Tasks.',
      actionLabel: 'Confirm & Create Task',
      isDestructive: false,
      itemDetails: { title, notes, targetList: 'Google Tasks (@default)' },
      onConfirm: async () => {
        await onConfirm();
        const newTask: TaskItem = {
          id: `gt-${Date.now()}`,
          userId: user?.uid || 'user',
          title,
          description: notes,
          priority: 'high',
          status: 'pending',
          category: 'workspace',
          dueDate: 'Tomorrow',
          createdAt: 'Just now',
        };
        setTasks((prev) => [newTask, ...prev]);
        if (user) {
          saveTaskToFirestore(newTask).catch(console.warn);
        }
        setActionHistory((prev) => [
          ...prev,
          {
            type: 'task_creation',
            task: newTask,
            timestamp: Date.now(),
          },
        ]);
        setModalState((s) => ({ ...s, isOpen: false }));
        audioEngine.speak(`Task "${title}" created with your approval.`, preferences.voiceName, true);
      },
    });
  };

  const handleCheckout = () => {
    const total = activeCart.reduce((s, i) => s + i.price * i.quantity, 0);
    setModalState({
      isOpen: true,
      title: 'Confirm Commerce Order Placement',
      description: `Please review your order total of $${total.toFixed(
        2
      )}. This will stage the checkout transaction on your account.`,
      actionLabel: 'Place Order',
      isDestructive: false,
      itemDetails: { items: activeCart, total: `$${total.toFixed(2)}` },
      onConfirm: () => {
        const newOrder: CommerceOrder = {
          id: `ord-${Date.now()}`,
          userId: user?.uid || 'guest',
          title: activeCart[0]?.name || 'Commerce Bundle',
          items: [...activeCart],
          totalAmount: total,
          currency: 'USD',
          status: 'approved',
          approvalRequired: true,
          createdAt: 'Just now',
        };
        setOrders((prev) => [newOrder, ...prev]);
        if (user) {
          saveOrderToFirestore(newOrder).catch(console.warn);
        }
        setActiveCart([]);
        setModalState((s) => ({ ...s, isOpen: false }));
        audioEngine.speak('Your commerce order has been approved and placed.', preferences.voiceName, true);
      },
    });
  };

  const handleUpdateTaskPriority = (taskId: string, newPriority: Priority) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const updated: TaskItem = {
            ...t,
            priority: newPriority,
            updatedAt: 'Just now',
          };
          if (user) {
            saveTaskToFirestore(updated).catch(console.warn);
          }
          return updated;
        }
        return t;
      })
    );
  };

  const handleDeleteMessage = (messageId: string) => {
    setConversationMessages((prev) => prev.filter((m) => m.id !== messageId));
    if (user) {
      deleteMessageFromFirestore(messageId).catch(console.warn);
    }
  };

  const handleClearHistory = () => {
    setConversationMessages([]);
    if (user) {
      clearUserMessages(user.uid).catch(console.warn);
    }
  };

  const handleSceneActivate = (sceneName: string) => {
    audioEngine.speak(`Activating smart home scene: ${sceneName}`, preferences.voiceName, true);
    setAssistantReply(`Smart Home Scene "${sceneName}" activated via Matter bridge.`);
  };

  // Keyboard Shortcuts (Space for mic, Esc for interrupt)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        toggleListening();
      } else if (e.code === 'Escape') {
        handleInterrupt();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isListening]);

  const handleTriggerWorkflow = (id: string) => {
    setWorkflows((prev) =>
      prev.map((w) => {
        const matches = w.id === id || (id === 'wf-briefing' && (w.id === 'wf-morning' || w.id === 'wf-1'));
        if (!matches) return w;
        return {
          ...w,
          status: 'running',
          currentStepIndex: 0,
          steps: w.steps.map((s, i) => (i === 0 ? { ...s, status: 'running' } : { ...s, status: 'pending' })),
        };
      })
    );
    audioEngine.speak('Executing ambient routine. Steps are updating live on your Smart Display timeline.', preferences.voiceName, true);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      setWorkflows((prev) =>
        prev.map((w) => {
          const matches = w.id === id || (id === 'wf-briefing' && (w.id === 'wf-morning' || w.id === 'wf-1'));
          if (!matches) return w;
          if (step >= w.steps.length) {
            clearInterval(interval);
            return {
              ...w,
              status: 'completed',
              steps: w.steps.map((s) => ({ ...s, status: 'completed' })),
            };
          }
          const nextStep = w.steps[step];
          const isApproval = nextStep?.status === 'approval_required' || nextStep?.service === 'mcp_core';
          if (isApproval) {
            clearInterval(interval);
            return {
              ...w,
              status: 'pending_approval',
              currentStepIndex: step,
              steps: w.steps.map((s, i) => {
                if (i < step) return { ...s, status: 'completed' };
                if (i === step) return { ...s, status: 'approval_required' };
                return s;
              }),
            };
          }
          return {
            ...w,
            status: 'running',
            currentStepIndex: step,
            steps: w.steps.map((s, i) => {
              if (i < step) return { ...s, status: 'completed' };
              if (i === step) return { ...s, status: 'running' };
              return s;
            }),
          };
        })
      );
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 flex flex-col font-['Plus_Jakarta_Sans'] transition-colors duration-200">
      {/* Ambient Header */}
      <AmbientHeader
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        audioStatus={audioStatus}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        mcpStatus={mcpStatus}
        activeView={activeView}
        onNavigate={setActiveView}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onOpenOnboarding={handleOpenOnboarding}
      />

      {/* Main Body */}
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto">
        {/* Navigation Sidebar */}
        <Navigation
          activeView={activeView}
          onNavigate={setActiveView}
          unreadCount={messages.filter((m) => m.unread).length}
          pendingApprovalCount={workflows.filter((w) => w.status === 'pending_approval').length}
          onOpenOnboarding={handleOpenOnboarding}
        />

        {/* Dynamic Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {activeView === 'home' && (
            <HomeView
              audioStatus={audioStatus}
              transcript={transcript}
              assistantReply={assistantReply}
              isListening={isListening}
              onToggleListening={toggleListening}
              onInterrupt={handleInterrupt}
              onSendMessage={handleVoiceCommand}
              onQuickPrompt={handleVoiceCommand}
              events={events}
              messages={messages}
              tasks={googleTasks}
              hasGoogleToken={hasGoogleToken}
              accessToken={accessToken}
              onLogin={handleLogin}
              activeWorkflowSteps={workflows[0]?.steps || []}
              workflowStatus={workflows[0]?.status || 'idle'}
              onApproveStep={handleApproveStep}
              onRequestTaskConfirmation={handleRequestTaskConfirmation}
              onNavigate={setActiveView}
              onSceneActivate={handleSceneActivate}
              onOpenOnboarding={handleOpenOnboarding}
              onTriggerWorkflow={handleTriggerWorkflow}
            />
          )}

          {activeView === 'conversations' && (
            <ConversationsView
              messages={conversationMessages}
              onSendMessage={handleVoiceCommand}
              onClearHistory={handleClearHistory}
              onDeleteMessage={handleDeleteMessage}
              onPlaySpeech={(text) => audioEngine.speak(text, preferences.voiceName, true)}
            />
          )}

          {activeView === 'workflows' && (
            <WorkflowsView
              workflows={workflows}
              onTriggerWorkflow={handleTriggerWorkflow}
              onApproveStep={handleApproveStep}
              accessToken={accessToken}
              onLogin={handleLogin}
              onRequestTaskConfirmation={handleRequestTaskConfirmation}
            />
          )}

          {activeView === 'tasks' && (
            <TasksView
              tasks={tasks}
              onAddTask={(newTask) => {
                const item: TaskItem = {
                  ...newTask,
                  id: `t-${Date.now()}`,
                  userId: user?.uid || 'user',
                  createdAt: 'Just now',
                };
                setTasks((prev) => [item, ...prev]);
                if (user) {
                  saveTaskToFirestore(item).catch(console.warn);
                }
                setActionHistory((prev) => [
                  ...prev,
                  {
                    type: 'task_creation',
                    task: item,
                    timestamp: Date.now(),
                  },
                ]);
              }}
              onToggleTask={(id) =>
                setTasks((prev) =>
                  prev.map((t) => {
                    if (t.id === id) {
                      const updated: TaskItem = {
                        ...t,
                        status: t.status === 'completed' ? 'pending' : 'completed',
                      };
                      if (user) saveTaskToFirestore(updated).catch(console.warn);
                      return updated;
                    }
                    return t;
                  })
                )
              }
              onDeleteTask={(id) => {
                setTasks((prev) => prev.filter((t) => t.id !== id));
                if (user) {
                  deleteTaskFromFirestore(id).catch(console.warn);
                }
              }}
              onUpdatePriority={handleUpdateTaskPriority}
              onSyncGoogleTasks={async () => {
                if (accessToken) {
                  const gt = await getGoogleTasks(accessToken);
                  setGoogleTasks(gt);
                  audioEngine.speak('Google Tasks synchronized successfully.', preferences.voiceName, true);
                } else {
                  audioEngine.speak('Syncing demo task records.', preferences.voiceName, true);
                }
              }}
              hasGoogleToken={hasGoogleToken}
            />
          )}

          {activeView === 'commerce' && (
            <CommerceView
              orders={orders}
              activeCart={activeCart}
              onAddToCart={(item) => setActiveCart((prev) => [...prev, item])}
              onRemoveFromCart={(id) => setActiveCart((prev) => prev.filter((i) => i.id !== id))}
              onRequestCheckout={handleCheckout}
            />
          )}

          {activeView === 'memory' && (
            <MemoryView
              memories={memories}
              onAddMemory={(newMem) => {
                const item: MemoryItem = {
                  ...newMem,
                  id: `mem-${Date.now()}`,
                  userId: user?.uid || 'user',
                  createdAt: 'Just now',
                };
                setMemories((prev) => [item, ...prev]);
                if (user) {
                  saveMemoryToFirestore(item).catch(console.warn);
                }
              }}
              onDeleteMemory={(id) => {
                setMemories((prev) => prev.filter((m) => m.id !== id));
                if (user) {
                  deleteMemoryFromFirestore(id).catch(console.warn);
                }
              }}
            />
          )}

          {activeView === 'integrations' && (
            <IntegrationsView
              hasGoogleToken={hasGoogleToken}
              onConnectGoogle={handleLogin}
              mcpStatus={mcpStatus}
              mcpDetails={mcpDetails}
              onTestApi={(name) => {
                audioEngine.speak(`Testing integration query for ${name}`, preferences.voiceName, true);
              }}
            />
          )}

          {activeView === 'settings' && (
            <SettingsView
              user={user}
              userProfile={userProfile}
              onUpdateProfile={handleUpdateProfile}
              preferences={preferences}
              onUpdatePreferences={(newPrefs) => {
                const updated = { ...preferences, ...newPrefs };
                setPreferences(updated);
                if (user) {
                  saveUserPreferences(updated).catch(console.warn);
                }
              }}
              onLogin={handleLogin}
              onLogout={handleLogout}
              mcpStatus={mcpStatus}
              mcpDetails={mcpDetails}
              onTestMcpConnection={(url) => {
                mcpClient.setBaseUrl(url);
                mcpClient.checkStatus().then((res) => {
                  if (res.state === 'connected') {
                    setMcpStatus('live_nexus_core');
                  } else if (res.state === 'auth_required') {
                    setMcpStatus('auth_required');
                  } else {
                    setMcpStatus('demo_adapter');
                  }
                  setMcpDetails({
                    message: res.message,
                    missingComponents: res.missingComponents,
                    toolsCount: res.toolsCount,
                  });
                });
              }}
              hasGoogleToken={hasGoogleToken}
              theme={theme}
              onSetTheme={setTheme}
              onOpenOnboarding={handleOpenOnboarding}
            />
          )}
        </main>
      </div>

      {/* Voice Assistant Visual Audio Waveform & Frequency Bar Overlay (Active during 'listening' & 'speaking') */}
      {(audioStatus === 'listening' || audioStatus === 'speaking') && (
        <aside
          role="region"
          aria-label="Active voice assistant interaction"
          className={`fixed bottom-5 right-5 left-5 sm:left-auto sm:w-[480px] z-50 overflow-hidden rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 ${
            audioStatus === 'listening'
              ? 'border-cyan-500/40 bg-slate-950/90 shadow-cyan-950/50'
              : 'border-purple-500/40 bg-slate-950/90 shadow-purple-950/50'
          }`}
        >
          {/* Ambient Top Accent Glow Line */}
          <div
            className={`h-1 w-full ${
              audioStatus === 'listening'
                ? 'bg-gradient-to-r from-transparent via-cyan-400 to-transparent'
                : 'bg-gradient-to-r from-transparent via-purple-400 to-transparent'
            }`}
          />

          <div className="p-4 sm:p-5">
            {/* Header info row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                    audioStatus === 'listening'
                      ? 'border-cyan-500/40 bg-cyan-500/20 text-cyan-300'
                      : 'border-purple-500/40 bg-purple-500/20 text-purple-300'
                  }`}
                >
                  {audioStatus === 'listening' ? (
                    <Mic className="h-4 w-4 animate-bounce" />
                  ) : (
                    <Volume2 className="h-4 w-4 animate-pulse" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2 text-xs font-semibold tracking-wide text-white">
                    <span>{audioStatus === 'listening' ? 'Voice Input Active' : 'Speech Output Active'}</span>
                    <span className="text-slate-500">·</span>
                    <span
                      className={`text-[10px] font-mono uppercase tracking-wider ${
                        audioStatus === 'listening' ? 'text-cyan-400' : 'text-purple-400'
                      }`}
                    >
                      {audioStatus === 'listening' ? 'Natural Speech' : preferences.voiceName}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {audioStatus === 'listening' ? 'Listening to voice stream' : 'Synthesizing response'}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-2">
                {audioStatus === 'speaking' ? (
                  <button
                    onClick={handleInterrupt}
                    className="flex items-center space-x-1.5 rounded-lg border border-purple-500/40 bg-purple-500/20 px-3 py-1.5 text-xs font-medium text-purple-200 hover:bg-purple-500/30 transition-colors"
                  >
                    <Square className="h-3 w-3 fill-current" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    onClick={toggleListening}
                    className="flex items-center space-x-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/30 transition-colors"
                  >
                    <Square className="h-3 w-3 fill-current" />
                    <span>Done</span>
                  </button>
                )}
              </div>
            </div>

            {/* Visual Audio Waveform & Frequency Bar Animation with SVG Overlay */}
            <div className="relative h-16 w-full rounded-xl bg-slate-900/80 border border-slate-800/80 overflow-hidden flex items-center justify-center px-2">
              <AudioWaveformVisualizer
                status={audioStatus}
                variant="banner"
                barCount={32}
              />
            </div>

            {/* Live Text Caption / Transcript Snippet */}
            <div className="mt-3 text-xs text-slate-300 font-medium truncate">
              {audioStatus === 'listening' ? (
                transcript ? (
                  <span className="italic text-cyan-200">"{transcript}"</span>
                ) : (
                  <span className="text-slate-400">Listening for your command...</span>
                )
              ) : assistantReply ? (
                <span className="text-purple-200 truncate block">"{assistantReply}"</span>
              ) : (
                <span className="text-slate-400">Synthesizing speech response...</span>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* User Onboarding & Interactive Capability Tour Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={handleCloseOnboarding}
        onComplete={handleCompleteOnboarding}
        user={user}
        hasGoogleToken={hasGoogleToken}
        onLogin={handleLogin}
        onSampleVoicePrompt={handleVoiceCommand}
        audioStatus={audioStatus}
        isListening={isListening}
        onToggleListening={toggleListening}
      />

      {/* Mandatory Human-in-the-Loop Confirmation Modal */}
      <ConfirmationModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        description={modalState.description}
        actionLabel={modalState.actionLabel}
        isDestructive={modalState.isDestructive}
        itemDetails={modalState.itemDetails}
        onConfirm={modalState.onConfirm || (() => setModalState((s) => ({ ...s, isOpen: false })))}
        onCancel={() => setModalState((s) => ({ ...s, isOpen: false }))}
      />
    </div>
  );
}
