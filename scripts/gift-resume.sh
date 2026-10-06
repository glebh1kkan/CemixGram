#!/bin/bash
# Resume giftfetch until clean exit, accumulating allow-missing-thumb entries.
export SESSION=/root/CoachGram/.session/coach.session
cd /root/CoachGram || exit 1
ALLOW="5251512570732381560:photo:m"
for i in $(seq 1 30); do
  ./bin/fetchers/giftfetch -workers 1 -allow-missing-thumb "$ALLOW" \
    -out /root/CoachGram/seed-src/official-gifts > /root/CoachGram/logs/gf-pass.log 2>&1
  EC=$?
  TAIL=$(tail -2 /root/CoachGram/logs/gf-pass.log)
  echo "PASS $i exit=$EC :: $TAIL"
  if [ $EC -eq 0 ]; then echo "CLEAN_DONE"; break; fi
  STUCK=$(grep -o 'download document [0-9]* [a-z]* thumb "[a-z]*"' /root/CoachGram/logs/gf-pass.log | tail -1)
  if [ -n "$STUCK" ]; then
    ID=$(echo "$STUCK" | awk '{print $3}')
    KIND=$(echo "$STUCK" | awk '{print $4}')
    TYPE=$(echo "$STUCK" | sed 's/.*thumb "//;s/"//')
    ENTRY="$ID:$KIND:$TYPE"
    case "$ALLOW" in
      *"$ENTRY"*) echo "already allowed: $ENTRY, waiting 120s" ; sleep 120 ;;
      *) ALLOW="$ALLOW,$ENTRY"; echo "added to allow-list: $ENTRY" ;;
    esac
  else
    echo "plain doc flood, waiting 90s"
    sleep 90
  fi
done
find /root/CoachGram/seed-src/official-gifts -type f | wc -l
du -sh /root/CoachGram/seed-src/official-gifts
