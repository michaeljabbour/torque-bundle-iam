// Local ui-kit — pure descriptor creators, no external dependencies

function el(type, props = {}, children = null) {
  return { type, props, children };
}

export { el };

export const Stack = (props, children) => el('stack', props, children);
export const Grid = (props, children) => el('grid', props, children);
export const Text = (props) => el('text', props);
export const TextField = (props) => el('text-field', props);
export const Button = (props) => el('button', props);
export const Card = (props, children) => el('card', props, children);
export const Badge = (props) => el('badge', props);
export const Divider = (props) => el('divider', props || {});
export const Form = (props, children) => el('form', props, children);
export const Alert = (props) => el('alert', props);
export const Spinner = (props) => el('spinner', props || {});
export const Icon = (props) => el('icon', props);
export const Modal = (props, children) => el('modal', props, children);
export const TabBar = (props, children) => el('tab-bar', props, children);
export const StatCard = (props, children) => el('stat-card', props, children);
export const Avatar = (props) => el('avatar', props);
export const AvatarStack = (props, children) => el('avatar-stack', props, children);
export const ProgressBar = (props) => el('progress-bar', props);
export const Checklist = (props, children) => el('checklist', props, children);
export const FilterDropdown = (props) => el('filter-dropdown', props);
export const MiniBar = (props) => el('mini-bar', props);
export const InlineEdit = (props) => el('inline-edit', props);
export const Select = (props) => el('select', props);
