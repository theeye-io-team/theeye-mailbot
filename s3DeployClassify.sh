
if [ -z "${1+x}" ];
then
  name=`basename "$0"`
  echo "usage: "
  echo "   ${name} BUCKET"
  exit 1
fi

bucket=$1

cd ..


filename="theeye-mailbot-$(date +'%Y%m%d').tgz"

tar -czf "${filename}" theeye-mailbot/

aws s3 cp "${filename}" "s3://${bucket}/${filename}" --acl public-read

url="https://${bucket}.s3.amazonaws.com/${filename}"

echo "download url is ${url}"
