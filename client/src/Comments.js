import React from "react";
import ReactTimeAgo from "react-time-ago";
import Button from "./Button";
import CommentForm from "./CommentForm";
import ReactMarkdown from "react-markdown";
import gfm from "remark-gfm";
import RootCommentContext from "./RootCommentContext";
import { useState, useContext } from "react";
import axios from "axios";
function Comments(props) {
  const [showForm, setShowForm] = useState(false);
  const [loadingVote, setLoadingVote] = useState(false);

  const comments = props.comments.filter(
    (comment) => props.parentId === comment.parentId
  );
  const rootCommentInfo = useContext(RootCommentContext);
  function vote(commentId, type) {
    if (loadingVote) return;

    setLoadingVote(true);

    axios
      .post(
        `http://localhost:4000/comments/${commentId}/${type}vote`,
        {},
        { withCredentials: true }
      )
      .then(() => {
        rootCommentInfo.refreshComments();
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingVote(false));
  }

  return (
    <div className={"my-2 text-reddit_text"}>
      {comments.map((comment) => {
        const replies = props.comments.filter(
          (c) => c.parentId === comment._id
        );
        return (
          <div className="text-white" key={comment._id}>
            <div className="flex mb-2">
              <div className="bg-white w-12 h-12 rounded-full mr-2" />
              <div className="py-1 px-2 text-lg pt-2">{comment.author}</div>
              <div className="text-md px-2 py-1 pt-3">
                <ReactTimeAgo date={comment.postedAt} locale="en-IN" />
              </div>
            </div>
            <div className="border-l-2 border-reddit_text-darker p-3 ml-4 pb-0 pl-6">
              {/* {comment.body} */}
              <div>
                <ReactMarkdown remarkPlugins={[gfm]} children={comment.body} />
              </div>
              <div>
                <div className="flex items-center gap-4 mt-2">
                  <button
                    disabled={loadingVote}
                    onClick={() => vote(comment._id, "up")}
                    className="text-green-500 font-bold"
                  >
                    ▲ {comment.likes || 0}
                  </button>

                  <button
                    disabled={loadingVote}
                    onClick={() => vote(comment._id, "down")}
                    className="text-red-500 font-bold"
                  >
                    ▼ {comment.dislikes || 0}
                  </button>

                  <Button
                    type={"button"}
                    onClick={() => setShowForm(comment._id)}
                    className="bg-reddit_dark text-white border-none pr-0 pl-0 pd-3"
                  >
                    Reply
                  </Button>
                </div>

                {comment._id === showForm && (
                  <CommentForm
                    showAuthor={false}
                    parentId={comment._id}
                    rootId={props.rootId}
                    onSubmit={() => {
                      setShowForm(false);
                      rootCommentInfo.refreshComments();
                    }}
                    onCancel={(e) => setShowForm(false)}
                  />
                )}
                {replies.length > 0 && (
                  <Comments
                    comments={props.comments}
                    parentId={comment._id}
                    rootId={props.rootId}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Comments;
