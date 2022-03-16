import React, { createContext, useContext, useMemo } from 'react'
import {
  UseMutateFunction,
  useMutation,
  useQuery,
  useQueryClient,
} from 'react-query'

import {
  createTodo,
  CreateTodoRequest,
  completeTodo,
  CompleteTodoRequest,
  getTodos,
  removeTodo,
} from '@/api'
import { Todo } from '@/types'

interface TodosContextValue {
  todos?: Todo[]
  isLoadingTodos: boolean
  isUpdatingTodo: boolean
  createTodo: UseMutateFunction<Todo, Error, CreateTodoRequest>
  completeTodo: UseMutateFunction<Todo, Error, CompleteTodoRequest>
  removeTodo: UseMutateFunction<null, Error, number>
}

const TodosContext = createContext<TodosContextValue | null>(null)

export const TodosProvider: React.FC = ({ children }) => {
  const queryClient = useQueryClient()
  const { data: todos, isLoading: isLoadingTodos } = useQuery<Todo[]>(
    'todos',
    getTodos
  )

  const createTodoMutation = useMutation<Todo, Error, CreateTodoRequest>(
    createTodo,
    {
      onMutate: async ({ title, is_completed }) => {
        await queryClient.cancelQueries('todos')

        const prevTodos = queryClient.getQueryData<Todo[]>('todos')

        queryClient.setQueryData('todos', [
          ...(prevTodos || []),
          {
            id: -1,
            title,
            is_completed,
            created_at: new Date().toISOString(),
          },
        ])

        return { prevTodos }
      },
      onError: (_, __, context: any) => {
        queryClient.setQueryData('todos', context.prevTodos)
      },
      onSettled: () => queryClient.invalidateQueries('todos'),
    }
  )

  const completeTodoMutation = useMutation<Todo, Error, CompleteTodoRequest>(
    completeTodo,
    {
      onMutate: async ({ id, completed }) => {
        await queryClient.cancelQueries('todos')

        const prevTodos = queryClient.getQueryData<Todo[]>('todos')

        queryClient.setQueryData(
          'todos',
          prevTodos?.map(todo =>
            todo.id === id ? { ...todo, is_completed: completed } : todo
          )
        )

        return { prevTodos }
      },
      onError: (_, __, context: any) => {
        queryClient.setQueryData('todos', context.prevTodos)
      },
      onSettled: () => {
        queryClient.invalidateQueries('todos')
      },
    }
  )

  const removeTodoMutation = useMutation<null, Error, number>(removeTodo, {
    onMutate: async (id: number) => {
      await queryClient.cancelQueries('todos')

      const prevTodos = queryClient.getQueryData<Todo[]>('todos')

      queryClient.setQueryData(
        'todos',
        prevTodos?.filter(todo => todo.id !== id)
      )

      return { prevTodos }
    },
    onError: (_, __, context: any) => {
      queryClient.setQueryData('todos', context.prevTodos)
    },
    onSettled: () => {
      queryClient.invalidateQueries('todos')
    },
  })

  const value = useMemo(
    () => ({
      todos,
      isLoadingTodos,
      isUpdatingTodo: completeTodoMutation.isLoading,
      isCreatingTodo: createTodoMutation.isLoading,
      createTodo: createTodoMutation.mutate,
      completeTodo: completeTodoMutation.mutate,
      removeTodo: removeTodoMutation.mutate,
    }),
    [
      todos,
      isLoadingTodos,
      completeTodoMutation.isLoading,
      createTodoMutation.isLoading,
      createTodoMutation.mutate,
      completeTodoMutation.mutate,
      removeTodoMutation.mutate,
    ]
  )

  return <TodosContext.Provider value={value}>{children}</TodosContext.Provider>
}

export function useTodos() {
  const context = useContext(TodosContext)

  if (!context) {
    throw new Error('useTodos must be called within a TodosProvider')
  }

  return context
}
