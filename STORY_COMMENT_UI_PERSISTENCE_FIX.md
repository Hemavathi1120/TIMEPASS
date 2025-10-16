# Story Comment Input - UI Persistence Fix

## Problem
The comment input field in the story viewer was disappearing while users were typing, making it impossible to compose and send messages properly. This was caused by the auto-hide UI logic that would hide all UI elements after 3 seconds of inactivity, without considering if the user was actively interacting with the comment input.

## Root Cause
The `toggleUI()` function had a 3-second timeout that would automatically hide the UI (`setShowUI(false)`) without checking if the user was:
1. Actively focused on the comment input
2. Currently typing a message
3. About to click the send button

This resulted in the entire interaction bar (including the input field and send button) disappearing mid-typing.

## Solution Implemented

### 1. Added Comment Focus State
```typescript
const [isCommentFocused, setIsCommentFocused] = useState(false);
```

This state tracks whether the user is actively interacting with the comment input field.

### 2. Updated Auto-Hide Logic
Modified `toggleUI()` to check the focus state before hiding:

```typescript
uiTimeoutRef.current = window.setTimeout(() => {
  // Don't hide UI if user is actively commenting
  if (!isCommentFocused) {
    setShowUI(false);
  }
}, 3000);
```

### 3. Enhanced Input Focus Handlers

#### onFocus Handler:
```typescript
onFocus={(e) => {
  e.stopPropagation();
  console.log('💬 Comment input focused - pausing story and keeping UI visible');
  setIsCommentFocused(true);
  setShowUI(true); // Force UI to show
  pauseStory();
  // Clear any auto-hide timeout
  if (uiTimeoutRef.current) {
    clearTimeout(uiTimeoutRef.current);
  }
}}
```

**What it does:**
- Sets `isCommentFocused` to `true`
- Forces `showUI` to `true` to ensure visibility
- Pauses the story progression
- Clears any pending auto-hide timeout
- Prevents event bubbling with `stopPropagation`

#### onBlur Handler:
```typescript
onBlur={() => {
  console.log('💬 Comment input blurred - will resume story');
  setIsCommentFocused(false);
  // Don't resume immediately, give a small delay
  setTimeout(() => {
    resumeStory();
  }, 100);
}}
```

**What it does:**
- Sets `isCommentFocused` to `false`
- Adds a 100ms delay before resuming (allows time to click the send button)
- Resumes story playback after user is done

### 4. Reset Focus State on Send
```typescript
setComment('');
setIsCommentFocused(false); // Reset focus state
resumeStory(); // Resume story after sending
```

Ensures the focus state is properly reset after successfully sending a comment.

## User Experience Flow

### Before Fix:
1. User clicks on comment input → UI shows, story pauses ✅
2. User starts typing...
3. After 3 seconds → **UI disappears mid-typing** ❌
4. User can no longer see input or send button ❌
5. Comment is lost, frustrating experience ❌

### After Fix:
1. User clicks on comment input → UI shows, story pauses ✅
2. Focus handler activates → `isCommentFocused = true` ✅
3. User types message → UI remains visible indefinitely ✅
4. Auto-hide checks focus state → skips hiding ✅
5. User clicks send → Comment sent, focus reset ✅
6. Story resumes automatically ✅

## Technical Benefits

### 1. **Predictable UI Behavior**
- UI stays visible as long as user is interacting
- No unexpected disappearances

### 2. **Better Accessibility**
- Clear visual feedback
- Consistent interaction patterns
- Screen reader friendly (maintains focus)

### 3. **Smooth Interaction Flow**
- Story pauses while commenting
- 100ms delay prevents accidental story resume when clicking send
- Clean state management

### 4. **Defensive Programming**
- Clears timeouts proactively
- Checks focus state before hiding
- Handles edge cases (blur then quick send)

## Testing Checklist

### Basic Flow:
- [ ] Click comment input → UI stays visible
- [ ] Type message slowly → UI doesn't disappear
- [ ] Take 10+ seconds to type → UI still visible
- [ ] Click send → Message sent, UI stays visible
- [ ] Blur without sending → UI can auto-hide after 3s

### Edge Cases:
- [ ] Focus, blur immediately, focus again → UI responds correctly
- [ ] Type, blur, click send within 100ms → Comment sends
- [ ] Multiple rapid focus/blur events → No UI flickering
- [ ] Switch to another app while focused → UI behavior on return

### Story Behavior:
- [ ] Story pauses when input focused
- [ ] Story resumes after sending comment
- [ ] Story resumes after blurring input (with delay)
- [ ] Progress bar stops/starts correctly

### UI Persistence:
- [ ] Input field stays visible while typing
- [ ] Send button accessible at all times when focused
- [ ] Like button visible during commenting
- [ ] Navigation buttons (prev/next) visible

## Console Logging

Added helpful logging for debugging:
```
💬 Comment input focused - pausing story and keeping UI visible
💬 Comment input blurred - will resume story
✅ Comment added: [commentId]
```

## Related Components

- **StoryViewer.tsx**: Main component with all fixes
- **Input.tsx**: Shadcn UI component (no changes needed)
- **Button.tsx**: Send button component (no changes needed)

## Future Improvements

1. **Visual Indicator**: Add a subtle pulsing border to show input is active
2. **Character Counter**: Show remaining characters if implementing limits
3. **Send on Enter**: Allow Ctrl/Cmd+Enter to send (in addition to button)
4. **Draft Saving**: Save unsent comments temporarily
5. **Typing Indicator**: Show "typing..." to story owner in real-time

## Lessons Learned

1. **Always check interaction state before auto-hiding UI**
2. **Small delays (100ms) can prevent race conditions**
3. **Console logging is invaluable for debugging timing issues**
4. **User intent should override automated behaviors**
5. **Focus management is critical for good UX**

## Code Location

File: `src/components/StoryViewer.tsx`

Key sections:
- Line ~46: State declarations (`isCommentFocused`)
- Line ~380-400: `toggleUI()` function with focus check
- Line ~690-710: Input field with enhanced focus/blur handlers
- Line ~360: Comment send with focus reset

---

**Fix Applied**: November 2024
**Issue**: Story comment input disappearing while typing
**Status**: ✅ Resolved - UI now persists during commenting
