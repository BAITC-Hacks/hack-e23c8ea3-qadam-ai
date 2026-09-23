/** Resolve an inbox task only within the current company's tasks. */
export function resolveProposalTask(tasks, requestedTaskId, newTaskId) {
  return tasks.find((task) => task.id === requestedTaskId)
    || tasks.find((task) => task.id === newTaskId)
    || tasks[0]
}
