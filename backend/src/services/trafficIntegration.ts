/**
 * ==============================================================================
 * Traffic Controller Hardware Integration Adapter (src/services/trafficIntegration.ts)
 * ==============================================================================
 * What does this file do in plain English?
 * In this hackathon demonstration, traffic signals are simulated inside software.
 * In a future real-world city deployment, software cannot directly change municipal
 * traffic lights without interfacing with physical Area Traffic Control Systems (ATCS)
 * or SCATS / ITMS hardware controllers maintained by the Traffic Police.
 *
 * This file defines the formal contract (interface) that future hardware adapters
 * must follow:
 * 1. Guarantees safety fail-safes (if communication drops, lights return to local timing).
 * 2. Requires authorized credentials before any priority command is dispatched.
 * 3. In demo mode, it safely simulates the command without touching public street infrastructure.
 * ==============================================================================
 */

export type AuthorizedTrafficCommand = {
  signalCode: string;
  requestedPhase: "GREEN_FOR_AMBULANCE_APPROACH" | "RESTORE_LOCAL_PLAN";
  emergencyId: string;
  actor: "AUTHORIZED_TRAFFIC_CONTROLLER";
};

export interface TrafficControllerPort {
  requestPriority(command: AuthorizedTrafficCommand): Promise<{ accepted: boolean; reason: string }>;
}

/**
 * Safe Simulation Controller
 * Emulates the response of an actual street controller for hackathon demonstrations.
 */
export class SimulationTrafficController implements TrafficControllerPort {
  async requestPriority(command: AuthorizedTrafficCommand) {
    return {
      accepted: true,
      reason: `SIMULATION: ${command.requestedPhase} recorded for ${command.signalCode}. No field hardware was contacted.`,
    };
  }
}
