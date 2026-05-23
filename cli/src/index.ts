#!/usr/bin/env node
import { listPatterns } from '@opensilver/sdk';

const patterns = listPatterns();
console.log(JSON.stringify({ patterns }, null, 2));
