import TaskComment from "./TaskComment.js";
import Author from "./Author.js";

export default interface PopulatedTaskComment
  extends Omit<TaskComment, "author"> {
  author: Author;
}
