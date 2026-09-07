import api from "./api";
export const assignmentAcceptanceApi = {
  getPendingMine: () => api.get("/assignment-acceptance/pending/mine"),
  getState: (ticketId) => api.get(`/assignment-acceptance/${ticketId}`),
  propose: (ticketId, payload) => api.post(`/assignment-acceptance/${ticketId}/propose`, payload),
  accept: (ticketId, payload = {}) => api.post(`/assignment-acceptance/${ticketId}/accept`, payload),
  returnToQueue: (ticketId, payload = {}) => api.post(`/assignment-acceptance/${ticketId}/return-to-queue`, payload),
  redirect: (ticketId, payload) => api.post(`/assignment-acceptance/${ticketId}/redirect`, payload),
  getCollaborators: (ticketId) => api.get(`/assignment-acceptance/${ticketId}/collaborators`),
  addCollaborator: (ticketId, payload) => api.post(`/assignment-acceptance/${ticketId}/collaborators`, payload),
  removeCollaborator: (ticketId, userId) => api.delete(`/assignment-acceptance/${ticketId}/collaborators/${userId}`),
  getEmailParticipants: (ticketId) => api.get(`/assignment-acceptance/${ticketId}/email-participants`),
  addEmailParticipant: (ticketId, payload) => api.post(`/assignment-acceptance/${ticketId}/email-participants`, payload),
  removeEmailParticipant: (ticketId, participantId) => api.delete(`/assignment-acceptance/${ticketId}/email-participants/${participantId}`),
};
export default assignmentAcceptanceApi;
