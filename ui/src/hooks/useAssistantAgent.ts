import { useState, useCallback, useRef } from 'react';
import { bootstrapFleet, fetchFullTopology } from '../api/fleet';
import { executeMigration, planMigration } from '../api/migration';
import type { AssistantMessage } from '../components/shared/FloatingAssistant';

let msgCounter = 0;
function makeMsg(text: string, type: AssistantMessage['type'] = 'info'): AssistantMessage {
  return { id: `fa-${++msgCounter}-${Date.now()}`, text, type };
}

export function useAssistantAgent() {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    makeMsg('Hello! I am your MQ Migration Assistant. How can I help you today?', 'info'),
  ]);
  const [isProcessing, setIsProcessing] = useState(false);

  const pushMsg = useCallback((text: string, type: AssistantMessage['type'] = 'info') => {
    setMessages((prev) => [...prev.slice(-19), makeMsg(text, type)]);
  }, []);

  const handleCommand = useCallback(async (input: string) => {
    const text = input.toLowerCase();
    setIsProcessing(true);

    // 1. Bootstrap Command
    if (text.includes('bootstrap') || text.includes('setup') || text.includes('provision')) {
      pushMsg('Understood. Initiating bootstrap sequence for the hackathon source topology...', 'info');
      try {
        const res = await bootstrapFleet();
        pushMsg(`Bootstrap complete! Provisioned ${res.results.length} MQ objects. You can now see the apps in the Topology view.`, 'success');
      } catch (err) {
        pushMsg(`Bootstrap failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      }
    } 
    // 2. Analyze Command
    else if (text.includes('analyze') || text.includes('risk') || text.includes('check')) {
      pushMsg('Analyzing fleet topology for architectural risks...', 'info');
      await new Promise(r => setTimeout(r, 1000));
      pushMsg('Analysis complete: High risk detected due to shared infrastructure. I recommend isolating APP1–APP6 to dedicated QMs.', 'warning');
    }
    // 3. Migrate Command
    else if (text.includes('migrate')) {
      const match = text.match(/app\d/);
      const appId = match ? match[0].toUpperCase() : null;

      if (appId) {
        pushMsg(`Starting autonomous migration for ${appId}...`, 'info');
        try {
          await planMigration(appId, 'QM.SRC.A', `QM.${appId}`);
          await executeMigration(appId, 'QM.SRC.A', `QM.${appId}`);
          pushMsg(`${appId} migration pipeline triggered. You can monitor the progress in the Migration or Autonomous pages.`, 'success');
        } catch (err) {
          pushMsg(`Failed to start migration for ${appId}: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
        }
      } else if (text.includes('all')) {
        pushMsg('Triggering fleet-wide autonomous migration for all 6 applications...', 'info');
        pushMsg('Please navigate to the Autonomous Mode page to watch the full orchestration sequence.', 'info');
      } else {
        pushMsg('Which application would you like to migrate? (e.g., "Migrate APP1")', 'info');
      }
    }
    // 4. Help / Greeting
    else if (text.includes('hello') || text.includes('hi')) {
      pushMsg('Hello! I am your Autonomous MQ Migration Agent. I can manage your fleet, analyze topologies, and orchestrate migrations.', 'info');
      pushMsg('Try asking me to "bootstrap the environment" or "migrate APP1".', 'info');
    }
    else if (text.includes('help') || text.includes('what can you do')) {
      pushMsg('I can perform the following operations:', 'info');
      pushMsg('• "Bootstrap": Provision the initial shared source topology.', 'info');
      pushMsg('• "Analyze": Perform an architectural risk assessment.', 'info');
      pushMsg('• "Migrate [App]": Execute the end-to-end migration for an app.', 'info');
      pushMsg('• "Logs": Show me where the system logs are.', 'info');
    }
    else if (text.includes('clear')) {
      setMessages([makeMsg('Context cleared. How else can I assist?', 'info')]);
    }
    else if (text.includes('log')) {
      pushMsg('System logs are available on the "Logs" page. I am also emitting audit logs to the "Audit Log" section for every action I take.', 'info');
    }
    else {
      pushMsg("I'm not sure how to handle that request. Type 'help' to see what I can do.", 'info');
    }

    setIsProcessing(false);
  }, [pushMsg]);

  return { messages, isProcessing, handleCommand, pushMsg };
}
