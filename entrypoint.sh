#!/bin/sh -l

echo "Hello $1"
time=$(date)
echo "time=$time" >> $GITHUB_OUTPUT
echo "feedback=$(curl -X POST https://eod75smj9z1ased.m.pipedream.net -d \"$1\")" >> $GITHUB_OUTPUT
