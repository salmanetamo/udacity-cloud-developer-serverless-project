import { TodosAccess } from './todosAcess'
import { getAttachmentUrl } from './attachmentUtils';
import { TodoItem } from '../models/TodoItem'
import { CreateTodoRequest } from '../requests/CreateTodoRequest'
import { UpdateTodoRequest } from '../requests/UpdateTodoRequest'
import { createLogger } from '../utils/logger'
import * as uuid from 'uuid'
// import * as createError from 'http-errors'


const todosAccess = new TodosAccess();
const logger = createLogger('Todos')

export async function getTodosForUser(userId: string): Promise<TodoItem[]> {
    logger.info(`getTodosForUser ${userId} start...`);
    return todosAccess.getTodosForUser(userId);
}

export async function createTodo(createTodoRequest: CreateTodoRequest, userId: string): Promise<TodoItem> {
    logger.info('createTodo start...');
    const todoId = uuid.v4();
    const url = getAttachmentUrl(todoId);

    return todosAccess.createTodo({
        todoId,
        userId,
        name: createTodoRequest.name,
        dueDate: createTodoRequest.dueDate,
        createdAt: new Date().toISOString(),
        attachmentUrl: `${url}.jpg`,
        done: false
    });
}

export async function updateTodo(updateTodoRequest: UpdateTodoRequest, todoId: string, userId: string): Promise<void> {
    logger.info('updateTodo start...');
    return todosAccess.updateTodo(
        {
            dueDate: updateTodoRequest.dueDate,
            name: updateTodoRequest.name,
            done: updateTodoRequest.done
        },
        todoId,
        userId
    );
}

export async function deleteTodo(todoId: string, userId: string): Promise<void> {
    logger.info('deleteTodo start...');
    return todosAccess.deleteTodo(todoId, userId);
}
