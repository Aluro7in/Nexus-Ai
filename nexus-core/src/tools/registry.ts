/**
 * Nexus AI — MCP Tool Registry
 *
 * Implements the 5 core tools requested plus the confirmation gate tool.
 * Every tool defines a validated Zod input schema, structured response,
 * and clear error handling.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { persistence } from '../store/persistence.js';
import type { CartItem } from '../types.js';

export function registerNexusTools(server: McpServer, userId?: string): void {
  // 1. nexus_get_context
  server.tool(
    'nexus_get_context',
    "Return the current user's configured demo preferences, workspace defaults, and relevant workflow context.",
    {
      query: z
        .string()
        .optional()
        .describe('Optional search query to filter or emphasize specific user preferences (e.g., "coffee", "focus", "calendar").'),
    },
    async (args) => {
      try {
        const profile = await persistence.getContextProfile(userId);
        const isDemo = profile.userId === 'user_alex_rivera';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'SUCCESS',
                  data: profile,
                  query: args.query || null,
                  provenance: isDemo ? 'nexus_demo_fixture' : 'authenticated_user_profile',
                  note: isDemo
                    ? 'Demo baseline context loaded for Alex Rivera.'
                    : `Personalized user context retrieved for ${profile.userName}.`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'FAILED',
                error: err instanceof Error ? err.message : String(err),
              }),
            },
          ],
        };
      }
    }
  );

  // 2. nexus_get_schedule
  server.tool(
    'nexus_get_schedule',
    'Retrieve calendar events using a provider interface (returns sample calendar data in demo mode until real Google Calendar is bound).',
    {
      targetDate: z
        .string()
        .optional()
        .describe('Target date to inspect: "today", "tomorrow", or ISO YYYY-MM-DD (defaults to "tomorrow").'),
      includeBuffer: z
        .boolean()
        .optional()
        .describe('Whether to calculate prep buffer windows before meetings.'),
    },
    async (args) => {
      try {
        const events = await persistence.getSchedule(args.targetDate || 'tomorrow', userId);
        const firstMeeting = events.find((e) => e.isFirstMeeting) || events[0] || null;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'SUCCESS',
                  targetDate: args.targetDate || 'tomorrow',
                  eventCount: events.length,
                  events,
                  firstMeeting,
                  source: 'sample_calendar_adapter',
                  integrationNotice:
                    'Sample calendar adapter active (OAuth 2.0 Google Workspace connector available in Phase 2).',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'FAILED',
                error: err instanceof Error ? err.message : String(err),
              }),
            },
          ],
        };
      }
    }
  );

  // 3. nexus_create_task
  server.tool(
    'nexus_create_task',
    'Create and persist a task with priority, due date, and structured description in the Nexus store.',
    {
      title: z.string().min(1).describe('The headline task description.'),
      description: z.string().optional().describe('Extended context or preparation details.'),
      dueDate: z.string().optional().describe('ISO timestamp for when this task is due.'),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().describe('Task priority level.'),
    },
    async (args) => {
      try {
        const task = await persistence.createTask({
          title: args.title,
          description: args.description,
          dueDate: args.dueDate,
          priority: args.priority || 'MEDIUM',
          userId,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'SUCCESS',
                  message: `Task successfully persisted: "${task.title}"`,
                  task,
                  store: 'nexus_persistence_store',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'FAILED',
                error: err instanceof Error ? err.message : String(err),
              }),
            },
          ],
        };
      }
    }
  );

  // 4. nexus_stage_cart
  server.tool(
    'nexus_stage_cart',
    'Create an itemized grocery or product cart for review, staging the order in pending status without making a purchase or payment.',
    {
      items: z
        .array(
          z.object({
            id: z.string().optional(),
            title: z.string().min(1).describe('Item or product name.'),
            category: z.string().optional().describe('Product category (e.g., Grocery, Office, Coffee).'),
            quantity: z.number().int().min(1).describe('Quantity of items.'),
            unitPrice: z.number().min(0).describe('Unit price in USD.'),
          })
        )
        .min(1)
        .describe('List of items to stage in the shopping cart.'),
    },
    async (args) => {
      try {
        const cartItems: CartItem[] = args.items.map((item, idx) => ({
          id: item.id || `item_${idx + 1}`,
          title: item.title,
          category: item.category || 'Grocery',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: Math.round(item.quantity * item.unitPrice * 100) / 100,
        }));

        const staged = await persistence.stageCart(cartItems, userId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'PENDING_APPROVAL',
                  message: `Cart staged with ${cartItems.length} item(s). Awaiting explicit user approval before placement.`,
                  stagedCart: staged,
                  confirmationToken: staged.confirmationToken,
                  safetyNote: 'No transaction has occurred. Requires approval via nexus_confirm_action or UI button.',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'FAILED',
                error: err instanceof Error ? err.message : String(err),
              }),
            },
          ],
        };
      }
    }
  );

  // 5. nexus_get_workflow_status
  server.tool(
    'nexus_get_workflow_status',
    'Return the execution state, operation log, and pending approvals of the current or latest workflow.',
    {
      workflowId: z.string().optional().describe('Specific workflow execution ID to inspect (or omit to fetch latest).'),
    },
    async (args) => {
      try {
        const workflow = args.workflowId
          ? await persistence.getWorkflowStatus(args.workflowId, userId)
          : await persistence.getLatestWorkflow(userId);

        if (!workflow) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  status: 'IDLE',
                  message: 'No active or past workflow runs found.',
                }),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'SUCCESS',
                  workflow,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'FAILED',
                error: err instanceof Error ? err.message : String(err),
              }),
            },
          ],
        };
      }
    }
  );

  // 6. nexus_confirm_action (Approval state machine gatekeeper)
  server.tool(
    'nexus_confirm_action',
    'Explicitly confirm or reject a pending staged action (such as ordering coffee) using its confirmation token or stage ID.',
    {
      tokenOrStageId: z.string().min(1).describe('The confirmationToken or stageId associated with the pending action.'),
      decision: z.enum(['APPROVE', 'REJECT']).describe('User decision: "APPROVE" or "REJECT".'),
    },
    async (args) => {
      try {
        const result = await persistence.confirmAction(args.tokenOrStageId, args.decision, userId);
        return {
          isError: !result.success,
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: err instanceof Error ? err.message : String(err),
              }),
            },
          ],
        };
      }
    }
  );

  // ───────────────────────────────────────────────────────────────────────────
  // COMPATIBILITY ALIAS LAYER (Namespaced Tools for AI Studio & Contract Specs)
  // ───────────────────────────────────────────────────────────────────────────

  // Shared schemas for compatibility aliases
  const calendarSchema = {
    timeMin: z.string().optional().describe('Start of calendar window (ISO timestamp or date).'),
    targetDate: z.string().optional().describe('Target date to inspect: "today", "tomorrow", or ISO YYYY-MM-DD.'),
    includeBuffer: z.boolean().optional().describe('Whether to calculate prep buffer windows.'),
  };

  const calendarHandler = async (args: { timeMin?: string; targetDate?: string; includeBuffer?: boolean }) => {
    try {
      const target = args.targetDate || (args.timeMin ? args.timeMin.split('T')[0] : 'tomorrow');
      const events = await persistence.getSchedule(target, userId);
      const firstMeeting = events.find((e) => e.isFirstMeeting) || events[0] || null;

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                status: 'SUCCESS',
                targetDate: target,
                eventCount: events.length,
                events,
                firstMeeting,
                source: 'sample_calendar_adapter',
                note: 'Retrieved schedule matching calendar window.',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              status: 'FAILED',
              error: err instanceof Error ? err.message : String(err),
            }),
          },
        ],
      };
    }
  };

  // Register both dot notation and underscore notation
  server.tool('workspace.calendar.list_events', 'Retrieve calendar events for a designated date window.', calendarSchema, calendarHandler);
  server.tool('workspace_calendar_get_events', 'Retrieve calendar events for a designated date window (underscore alias).', calendarSchema, calendarHandler);

  const taskSchema = {
    title: z.string().min(1).describe('Task headline or summary.'),
    notes: z.string().optional().describe('Task briefing notes or details.'),
    description: z.string().optional().describe('Alternative task description field.'),
    dueDate: z.string().optional().describe('ISO timestamp for task due date.'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().describe('Task priority level.'),
  };

  const taskHandler = async (args: {
    title: string;
    notes?: string;
    description?: string;
    dueDate?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  }) => {
    try {
      const description = args.description || args.notes;
      const task = await persistence.createTask({
        title: args.title,
        description,
        dueDate: args.dueDate,
        priority: args.priority || 'MEDIUM',
        userId,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                status: 'SUCCESS',
                message: `Task successfully persisted: "${task.title}"`,
                task,
                store: 'nexus_persistence_store',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              status: 'FAILED',
              error: err instanceof Error ? err.message : String(err),
            }),
          },
        ],
      };
    }
  };

  server.tool('workspace.tasks.create', 'Create and persist a task in Google Tasks / Nexus store.', taskSchema, taskHandler);
  server.tool('workspace_tasks_manage', 'Create and manage tasks (underscore alias).', taskSchema, taskHandler);

  const cartSchema = {
    items: z
      .array(
        z.object({
          id: z.string().optional(),
          title: z.string().min(1).describe('Product title.'),
          category: z.string().optional().describe('Product category.'),
          quantity: z.number().int().min(1).optional().describe('Quantity of items.'),
          unitPrice: z.number().min(0).optional().describe('Unit price in USD.'),
          price: z.number().min(0).optional().describe('Alternative unit price field.'),
        })
      )
      .min(1)
      .describe('Items to stage for checkout.'),
  };

  const cartHandler = async (args: {
    items: Array<{
      id?: string;
      title: string;
      category?: string;
      quantity?: number;
      unitPrice?: number;
      price?: number;
    }>;
  }) => {
    try {
      const cartItems: CartItem[] = args.items.map((item, idx) => {
        const unitPrice = item.unitPrice ?? item.price ?? 0;
        const quantity = item.quantity ?? 1;
        return {
          id: item.id || `item_${idx + 1}`,
          title: item.title,
          category: item.category || 'Grocery',
          quantity,
          unitPrice,
          totalPrice: Math.round(quantity * unitPrice * 100) / 100,
        };
      });

      const staged = await persistence.stageCart(cartItems, userId);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                status: 'PENDING_APPROVAL',
                message: `Cart staged with ${cartItems.length} item(s). Awaiting explicit user approval before placement.`,
                stagedCart: staged,
                confirmationToken: staged.confirmationToken,
                safetyNote: 'No transaction has occurred. Requires approval via nexus_confirm_action or UI button.',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              status: 'FAILED',
              error: err instanceof Error ? err.message : String(err),
            }),
          },
        ],
      };
    }
  };

  server.tool('commerce.cart.prepare_checkout', 'Stage an itemized commerce cart for visual review before checkout.', cartSchema, cartHandler);
  server.tool('commerce_stage_order', 'Stage commerce order (underscore alias).', cartSchema, cartHandler);

  const gmailSchema = {
    query: z.string().optional().describe('Search query for emails (e.g. "Product Strategy", "sync", "briefing").'),
  };

  const gmailHandler = async (args: { query?: string }) => {
    const q = args.query ? args.query.toLowerCase() : '';
    const mockThreads = [
      {
        id: 'msg_001',
        from: 'maya.k@company.com',
        subject: 'Re: Q3 Product Strategy Review — Slide deck updates',
        date: new Date(Date.now() - 3600000).toISOString(),
        snippet: 'Uploaded final architecture slides for Nexus AI release. Please review slides 12-15 before 9 AM sync.',
        hasAttachments: true,
        unread: true,
      },
      {
        id: 'msg_002',
        from: 'alex.r@company.com',
        subject: 'Weekly Coffee Subscription Notification',
        date: new Date(Date.now() - 86400000).toISOString(),
        snippet: 'Your preferred Ethiopian Yirgacheffe single-origin bag is ready for reorder.',
        hasAttachments: false,
        unread: false,
      },
    ];

    const filtered = q
      ? mockThreads.filter((t) => t.subject.toLowerCase().includes(q) || t.snippet.toLowerCase().includes(q))
      : mockThreads;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              status: 'SUCCESS',
              query: args.query || null,
              threadsFound: filtered.length,
              threads: filtered,
              source: 'sample_gmail_adapter',
              note: 'Sample Gmail adapter active (OAuth 2.0 Google Workspace connector available in Phase 2).',
            },
            null,
            2
          ),
        },
      ],
    };
  };

  server.tool('workspace.gmail.summarize_threads', 'Search and summarize relevant unread emails or threads.', gmailSchema, gmailHandler);
  server.tool('workspace_gmail_query', 'Query Gmail messages (underscore alias).', gmailSchema, gmailHandler);

  const sceneSchema = {
    sceneId: z.string().describe('ID or name of the smart home lighting/workspace scene.'),
  };

  const sceneHandler = async (args: { sceneId: string }) => {
    try {
      const updated = await persistence.updateContextProfile({
        preferences: {
          workspace: {
            focusModeScene: args.sceneId,
            colorTemperatureK: 2700,
            brightnessPercent: 35,
            dndEnabled: true,
          },
        } as any,
      }, userId);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                status: 'SUCCESS',
                message: `Smart home scene "${args.sceneId}" activated.`,
                activeScene: args.sceneId,
                workspace: updated.preferences.workspace,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              status: 'FAILED',
              error: err instanceof Error ? err.message : String(err),
            }),
          },
        ],
      };
    }
  };

  server.tool('smarthome.scenes.activate', 'Activate a smart home lighting or workspace preset scene.', sceneSchema, sceneHandler);
  server.tool('smart_home_set_scene', 'Set smart home scene (underscore alias).', sceneSchema, sceneHandler);
}
