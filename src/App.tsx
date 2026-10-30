/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { testFirestoreConnection } from './lib/firebase';
import { initAuth, googleSignIn, logout } from './lib/auth';
import {
  syncUserProfile,
  getUserPreferences,
  saveUserPreferences,
  fetchUserTasks,
  saveTaskToFirestore,
  deleteTaskFromFirestore,
  fetchUserMessages,
  saveMessageToFirestore,
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

  // 5. User Preferences
  const [preferences, setPreferences] = useState<UserPreference>({
    userId: 'guest',
    voiceName: 'Zephyr',
    ambientTheme: 'cyber-dark',
    autoSpeak: true,
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
      id: 'init-msg-1',
      conversationId: 'c1',
      role: 'assistant',
      content:
        "Hello! I'm Nexus AI, your ambient operating system for the Alexa+ hackathon. I'm connected to your schedule, communication, tasks, smart home scenes, and commerce. How can I assist your workflow today?",
      createdAt: 'Just now',
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

        // Fetch User Preferences & Collections from Firestore
        try {
          const userPrefs = await getUserPreferences(firebaseUser.uid);
          if (userPrefs) {
            setPreferences((prev) => ({ ...prev, ...userPrefs }));
            if (userPrefs.hasCompletedOnboarding) {
              setShowOnboarding(false);
            }
          } else {
            const initialPref: UserPreference = {
              userId: firebaseUser.uid,
              voiceName: 'Zephyr',
              ambientTheme: 'cyber-dark',
              autoSpeak: true,
              mcpBackendUrl: 'http://localhost:8080/mcp',
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
  }, [preferences.voiceName, preferences.autoSpeak, events, messages, tasks]);

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
      const lower = command.toLowerCase();
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
        detectedToolCalls.push({
          name: 'workspace_tasks_manage',
          args: { task: command },
          result: { status: 'created' },
          status: 'success',
        });
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
      await audioEngine.speak(reply, preferences.voiceName, preferences.autoSpeak);
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
    setAccessToken(null);
    setHasGoogleToken(false);
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
    setModalState({
      isOpen: true,
      title: 'Authorize External Action Execution',
      description:
        'Nexus AI requires your explicit human-in-the-loop permission to execute this workflow step. No external action will be submitted without your consent.',
      actionLabel: 'Approve & Execute',
      isDestructive: false,
      itemDetails: { stepId, authorizationTime: new Date().toISOString() },
      onConfirm: () => {
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
              onClearHistory={() => setConversationMessages([])}
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
