/**
 * ReactDom.createRoot(root).render(<App />)
 */
import { Container } from "./hostConfig";
import {
  createContainer,
  updateContainer,
} from "../../react-reconciler/src/filerReconciler";
import { ReactElementType } from "../../shared/ReactTypes";

export function createRoot(container: Container) {
  const root = createContainer(container);

  return {
    render(element: ReactElementType) {
      return updateContainer(element, root);
    },
  };
}
