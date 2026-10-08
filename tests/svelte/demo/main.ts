import { mount } from 'svelte';
import Demo from './Demo.svelte';
import Composition from './Composition.svelte';
import '../../../src/style.css';
mount(location.search.includes('composition') ? Composition : Demo, { target: document.getElementById('app')! });
