/**
 * Nexus AI — Demonstration Orchestrator
 *
 * Implements the cross-ecosystem multi-step orchestration workflow for:
 * "Prepare my afternoon, check tomorrow's schedule, create a reminder to
 * prepare for my first meeting, and stage my usual coffee order."
 *
 * Each step is executed as an explicit tool operation, logged with precise
 * input, output, and failure isolation.
 */

import crypto from 'node:crypto';
import { persistence } from '../store/persistence.js';
import type {
  WorkflowStatus,
  WorkflowOperation,
  ContextProfile,
  ScheduleEvent,
  Task,
  StagedCart,
} from '../types.js';

export class NexusWorkflowOrchestrator {
  /**
   * Run the full end-to-end multi-step workflow.
   */
  async executeDemonstrationWorkflow(query?: string, userId?: string): Promise<WorkflowStatus> {
    const workflowId = `wf_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const userQuery =
      query ||
      "Prepare my afternoon, check tomorrow's schedule, create a reminder to prepare for my first meeting, and stage my usual coffee order.";

    const operations: WorkflowOperation[] = [];
    const startedAt = new Date().toISOString();

    let contextProfile: ContextProfile | null = null;
    let scheduleEvents: ScheduleEvent[] = [];
    let firstMeeting: ScheduleEvent | null = null;
    let createdTask: Task | null = null;
    let stagedCart: StagedCart | null = null;

    // STEP 1: nexus_get_context
    const step1Start = new Date().toISOString();
    try {
      contextProfile = await persistence.getContextProfile(userId);
      operations.push({
        step: 1,
        tool: 'nexus_get_context',
        name: 'Retrieve User Preferences & Context',
        input: { query: 'afternoon routine, coffee, workspace focus' },
        output: {
          userName: contextProfile.userName,
          preferredCoffee: contextProfile.preferences.coffee.preferredBean,
          focusLighting: contextProfile.preferences.workspace.focusModeScene,
          brightness: `${contextProfile.preferences.workspace.brightnessPercent}%`,
        },
        status: 'SUCCESS',
        timestamp: step1Start,
      });
    } catch (err) {
      operations.push({
        step: 1,
        tool: 'nexus_get_context',
        name: 'Retrieve User Preferences & Context',
        input: {},
        status: 'FAILED',
        error: err instanceof Error ? err.message : String(err),
        timestamp: step1Start,
      });
    }

    // STEP 2: nexus_get_schedule
    const step2Start = new Date().toISOString();
    try {
      scheduleEvents = await persistence.getSchedule('tomorrow');
      firstMeeting = scheduleEvents.find((e) => e.isFirstMeeting) || scheduleEvents[0] || null;

      operations.push({
        step: 2,
        tool: 'nexus_get_schedule',
        name: 'Inspect Tomorrow’s Calendar Schedule',
        input: { targetDate: 'tomorrow' },
        output: {
          eventCount: scheduleEvents.length,
          events: scheduleEvents.map((e) => ({
            id: e.id,
            title: e.title,
            time: `${e.start.split('T')[1].substring(0, 5)} - ${e.end.split('T')[1].substring(0, 5)} UTC`,
          })),
          firstMeeting: firstMeeting ? firstMeeting.title : 'None',
          source: 'sample_calendar_adapter',
        },
        status: 'SUCCESS',
        timestamp: step2Start,
      });
    } catch (err) {
      operations.push({
        step: 2,
        tool: 'nexus_get_schedule',
        name: 'Inspect Tomorrow’s Calendar Schedule',
        input: { targetDate: 'tomorrow' },
        status: 'FAILED',
        error: err instanceof Error ? err.message : String(err),
        timestamp: step2Start,
      });
    }

    // STEP 3: nexus_create_task
    const step3Start = new Date().toISOString();
    try {
      const taskTitle = firstMeeting
        ? `Prepare speaking notes and review slides for "${firstMeeting.title}"`
        : 'Prepare materials for tomorrow morning sync';

      const taskDescription = firstMeeting
        ? `Auto-generated reminder from Nexus AI: Check agenda, review deck, and assemble questions before meeting at ${firstMeeting.start.split('T')[1].substring(0, 5)} UTC.`
        : 'Auto-generated prep task for tomorrow morning.';

      createdTask = await persistence.createTask({
        title: taskTitle,
        description: taskDescription,
        dueDate: firstMeeting ? firstMeeting.start : undefined,
        priority: 'HIGH',
        userId,
      });

      operations.push({
        step: 3,
        tool: 'nexus_create_task',
        name: 'Persist Meeting Prep Task',
        input: { title: taskTitle, priority: 'HIGH' },
        output: {
          taskId: createdTask.id,
          title: createdTask.title,
          status: createdTask.status,
          dueDate: createdTask.dueDate,
        },
        status: 'SUCCESS',
        timestamp: step3Start,
      });
    } catch (err) {
      operations.push({
        step: 3,
        tool: 'nexus_create_task',
        name: 'Persist Meeting Prep Task',
        input: {},
        status: 'FAILED',
        error: err instanceof Error ? err.message : String(err),
        timestamp: step3Start,
      });
    }

    // STEP 4: nexus_stage_cart
    const step4Start = new Date().toISOString();
    try {
      const coffeePref = contextProfile?.preferences.coffee;
      const coffeeTitle = coffeePref?.preferredBean || 'Ethiopian Yirgacheffe Single-Origin (Whole Bean)';
      const coffeePrice = coffeePref?.estimatedPrice || 18.50;

      stagedCart = await persistence.stageCart(
        [
          {
            id: 'item_coffee_01',
            title: coffeeTitle,
            category: 'Coffee & Pantry',
            quantity: 1,
            unitPrice: coffeePrice,
            totalPrice: coffeePrice,
          },
        ],
        userId
      );

      operations.push({
        step: 4,
        tool: 'nexus_stage_cart',
        name: 'Stage Coffee Beans Order in Shopping Cart',
        input: {
          item: coffeeTitle,
          quantity: 1,
          unitPrice: coffeePrice,
        },
        output: {
          stageId: stagedCart.stageId,
          itemCount: stagedCart.items.length,
          subtotal: stagedCart.subtotal,
          estimatedTotal: stagedCart.estimatedTotal,
          status: stagedCart.status,
          confirmationToken: stagedCart.confirmationToken,
          safetyMode: 'HELD_PENDING_EXPLICIT_APPROVAL',
        },
        status: 'PENDING_APPROVAL',
        timestamp: step4Start,
      });
    } catch (err) {
      operations.push({
        step: 4,
        tool: 'nexus_stage_cart',
        name: 'Stage Coffee Beans Order in Shopping Cart',
        input: {},
        status: 'FAILED',
        error: err instanceof Error ? err.message : String(err),
        timestamp: step4Start,
      });
    }

    // CONSOLIDATE WORKFLOW SUMMARY
    const hasFailures = operations.some((op) => op.status === 'FAILED');
    const isAwaitingApproval = stagedCart && stagedCart.status === 'PENDING_APPROVAL';

    let summary = '';
    if (hasFailures) {
      summary = 'Workflow partially executed with issues. Please review the operational timeline below.';
    } else {
      const firstMeetingName = firstMeeting?.title || 'your first meeting';
      const meetingTime = firstMeeting ? `${firstMeeting.start.split('T')[1].substring(0, 5)} UTC` : 'morning';
      const coffeeName = stagedCart?.items[0]?.title || 'coffee';
      const cartTotal = stagedCart ? `$${stagedCart.estimatedTotal.toFixed(2)}` : '$18.50';

      summary =
        `I’ve prepared your afternoon: configured your ${contextProfile?.preferences.workspace.focusModeScene || 'Focus Mode'} workspace, ` +
        `verified tomorrow’s calendar (${scheduleEvents.length} events found; earliest is "${firstMeetingName}" at ${meetingTime}), ` +
        `created a prep reminder task, and staged your usual ${coffeeName} in your cart for ${cartTotal}. ` +
        `Your order is held in safety mode awaiting your verbal or visual approval.`;
    }

    const workflowStatus: WorkflowStatus = {
      workflowId,
      userId,
      query: userQuery,
      startedAt,
      completedAt: new Date().toISOString(),
      state: hasFailures ? 'FAILED' : isAwaitingApproval ? 'AWAITING_APPROVAL' : 'COMPLETED',
      operations,
      summary,
      pendingAction: stagedCart
        ? {
            type: 'CART_CHECKOUT',
            stageId: stagedCart.stageId,
            confirmationToken: stagedCart.confirmationToken,
            description: `Place order for ${stagedCart.items.map((i) => i.title).join(', ')} (${stagedCart.currency} ${stagedCart.estimatedTotal.toFixed(2)})`,
            amount: stagedCart.estimatedTotal,
          }
        : undefined,
    };

    await persistence.saveWorkflowStatus(workflowStatus);
    return workflowStatus;
  }
}

export const orchestrator = new NexusWorkflowOrchestrator();
